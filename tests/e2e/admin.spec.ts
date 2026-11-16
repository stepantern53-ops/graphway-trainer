import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test,expect } from '@playwright/test';
import { credentialsSchema,csrfResponseSchema,authResponseSchema } from '../../packages/contracts/src/index';
import { enterCredentials,openLevel,solve,completeCurrent } from './helpers';

test.use({trace:'off',screenshot:'off',video:'off',reducedMotion:'reduce',viewport:{width:1440,height:900}});

test('admin all 24 levels open but mathematics remains required',async({page})=>{
 // Test provisioning owns this private file. Never attach or print its contents.
 const raw:unknown=JSON.parse(await readFile(resolve('.local/test-admin-access.json'),'utf8'));
 const checked=credentialsSchema.safeParse(raw);
 if(!checked.success)throw new Error('Test admin credentials are not available in the expected private artifact.');
 await page.goto('/');
 await page.getByRole('button',{name:'Вход',exact:true}).click();
 await enterCredentials(page,checked.data);
 const selected=page.waitForResponse(response=>response.url().endsWith('/api/progress/current')&&response.request().method()==='PUT');
 await page.getByRole('button',{name:'Войти и продолжить →'}).click();
 expect((await selected).status()).toBe(200);
 await expect(page.locator('#coefficient-b')).toBeVisible();
 const me=await page.request.get('/api/me');
 expect(me.status()).toBe(200);
 const session=authResponseSchema.parse(await me.json());
 expect(session.user.role==='admin').toBe(true);
 expect(session.progress.unlockedLevelIds.length===24).toBe(true);
 await page.goto('/#/episodes/quadratic');
 await expect(page.locator('button').filter({hasText:/^Q\d{2}/})).toHaveCount(12);
 expect(await page.locator('button').filter({hasText:/^Q\d{2}/}).evaluateAll(buttons=>buttons.every(button=>button instanceof HTMLButtonElement&&!button.disabled))).toBe(true);
 await openLevel(page,'Q12');
 await page.locator('#coefficient-a').fill('0');
 await expect(page.getByRole('button',{name:'▶ Пуск',exact:true})).toBeDisabled();
 await expect(page.getByTestId('current-graph')).toHaveCount(0);
 const tokenResponse=await page.request.get('/api/auth/csrf');
 const token=csrfResponseSchema.parse(await tokenResponse.json());
 const rejected=await page.request.post('/api/levels/Q12/complete',{headers:{Origin:new URL(page.url()).origin,'X-CSRF-Token':token.csrfToken},data:{curriculumVersion:'graphway-v1',coefficients:{a:'0',b:'0',c:'0'}}});
 expect(rejected.status()).toBe(400);
 await solve(page,'Q12');
 await completeCurrent(page);
 const completed=authResponseSchema.parse(await (await page.request.get('/api/me')).json());
 expect(completed.progress.completedLevelIds.includes('Q12')).toBe(true);
});
