import { test,expect } from '@playwright/test';
import { register,enterCredentials,currentProgress,newAccount } from './helpers';
import { Client } from 'pg';
import { loadRuntimeEnvironment } from '../../scripts/local-runtime.mjs';
import { readConfig } from '../../apps/server/src/config';

test.use({trace:'off',screenshot:'off',video:'off',viewport:{width:1440,height:900}});
test.setTimeout(60_000);

test.beforeEach(async({baseURL})=>{
 // Added scenarios must not exhaust the shared suite's signup envelope.
 // Only isolated3002/test PG may reset a test counter; live3001 never does.
 if(baseURL!=='http://127.0.0.1:3002')return;
 if(process.env.NODE_ENV!=='test')throw new Error('Signup isolation requires NODE_ENV=test.');
 const env=await loadRuntimeEnvironment();
 const config=readConfig();
 if(config.port!==3002||new URL(config.databaseUrl).pathname!=='/graphway_test')throw new Error('Refusing non-test server configuration.');
 if(new URL(env.TEST_DATABASE_URL).pathname!=='/graphway_test')throw new Error('Refusing non-test signup isolation.');
 const client=new Client({connectionString:env.TEST_DATABASE_URL});
 try{
  await client.connect();
  const target=await client.query('SELECT current_database() AS name');
  if(target.rows[0]?.name!=='graphway_test')throw new Error('Refusing non-test signup isolation.');
  await client.query("DELETE FROM auth_limits WHERE key LIKE 'signup-ip:%'");
 }finally{await client.end();}
});

for(const sameUser of [true,false]){
 test(`shared-cookie second-tab ${sameUser?'same-user login preserves arrived retry':'different-user login clears old owner RAM'}`,async({page,context})=>{
  await page.clock.install();
  const account=await register(page);
  await page.clock.pauseAt(new Date(Date.now()+2000));
  const firstIdentity=await (await page.request.get('/api/me')).json() as {user:{id:string}};
  const field=page.locator('#coefficient-b');
  await field.fill('2');
  // Keep a genuine arrived snapshot in the old tab before the session changes.
  await page.route('**/api/levels/L01/complete',route=>route.abort('failed'),{times:1});
  await page.getByRole('button',{name:'▶ Пуск',exact:true}).click();
  await page.clock.runFor(3200);
  await expect(page.getByRole('button',{name:'Повторить сохранение',exact:true})).toBeVisible();
  const arrived=await page.getByTestId('rider').getAttribute('transform');
  const second=await context.newPage();
  await second.goto('/');
  await second.getByRole('button',{name:/^◎ /}).click();
  await second.getByRole('button',{name:'Выйти из аккаунта',exact:true}).click();
  const next=sameUser?account:newAccount();
  if(sameUser)await second.getByRole('button',{name:'Вход',exact:true}).click();
  await enterCredentials(second,next);
  await second.getByRole('button',{name:sameUser?'Войти и продолжить →':'Создать аккаунт и открыть L01 →',exact:true}).click();
  await expect(second.locator('#coefficient-b')).toBeVisible();
  const secondIdentity=await (await second.request.get('/api/me')).json() as {user:{id:string}};
  expect(secondIdentity.user.id===firstIdentity.user.id).toBe(sameUser);
  await page.bringToFront();
  const rejected=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Повторить сохранение',exact:true}).click();
  expect((await rejected).status()).toBe(403);
  expect((await currentProgress(second)).completedCount).toBe(0);
  if(sameUser){
   await expect(page.getByRole('button',{name:'Повторить сохранение',exact:true})).toBeVisible();
   await expect(field).toHaveValue('2');
   const saved=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
   await page.getByRole('button',{name:'Повторить сохранение',exact:true}).click();
   expect((await saved).status()).toBe(200);
   await expect(page.getByTestId('route-status')).toContainText('Прохождение подтверждено сервером');
   expect(await page.getByTestId('rider').getAttribute('transform')).toBe(arrived);
   expect((await currentProgress(page)).completedLevelIds).toEqual(['L01']);
   expect((await (await page.request.get('/api/me')).json() as {user:{id:string}}).user.id).toBe(firstIdentity.user.id);
   const authRefreshes:string[]=[];
   page.on('request',request=>{if(['/api/me','/api/auth/csrf'].some(path=>request.url().endsWith(path)))authRefreshes.push(request.url());});
   const locked=page.waitForResponse(response=>response.url().endsWith('/api/levels/L03'));
   await page.evaluate(()=>{location.hash='/levels/L03';});
   expect((await locked).status()).toBe(403);
   await expect(page.getByRole('alert')).toContainText('Сначала пройди предыдущую трассу.');
   expect(authRefreshes).toEqual([]);
   await expect(page.locator('#password')).toHaveCount(0);
  }else{
   await expect(page.locator('#password')).toBeVisible();
   await expect(field).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Повторить сохранение',exact:true})).toHaveCount(0);
   await enterCredentials(page,next);
   await page.getByRole('button',{name:'Войти и продолжить →',exact:true}).click();
   await expect(field).toHaveValue('0');
   await expect(page.getByRole('button',{name:'▶ Пуск',exact:true})).toBeDisabled();
   await page.clock.runFor(4000);
   expect((await currentProgress(page)).completedCount).toBe(0);
  }
  await second.close();
 });
}
