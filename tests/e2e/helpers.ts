import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect,type Page } from '@playwright/test';
import { authResponseSchema,levelDTOSchema } from '../../packages/contracts/src/index';
import { WITNESSES,type LevelId } from '../../packages/curriculum/tests/witnesses';

export interface TestAccount {nickname:string;password:string}
export function newAccount():TestAccount{
 return {nickname:`student_${randomBytes(5).toString('hex')}`,password:randomBytes(24).toString('base64url')};
}

// Credentials are never step names, attachments, console output, snapshots or traces.
export async function enterCredentials(page:Page,account:TestAccount){
 await page.locator('#password').waitFor({state:'visible'});
 await page.evaluate(({nickname,password})=>{
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
  if(!setter)throw new Error('Native input setter is unavailable.');
  for(const [id,value] of [['nickname',nickname],['password',password]]){
   const input=document.getElementById(id!);
   if(!(input instanceof HTMLInputElement))throw new Error('Authentication input is unavailable.');
   setter.call(input,value);
   input.dispatchEvent(new Event('input',{bubbles:true}));
  }
 },account);
}

export async function register(page:Page,account=newAccount()){
 await page.goto('/');
 await expect(page.getByText('Восстановления пароля нет.',{exact:false})).toBeVisible();
 await enterCredentials(page,account);
 await page.getByRole('button',{name:'Создать аккаунт и открыть L01 →'}).click();
 await expect(page.locator('#coefficient-b')).toBeVisible();
 await expect(page).toHaveURL(/#\/levels\/L01$/);
 return account;
}

export async function openLevel(page:Page,id:string){
 await page.goto(`/#/levels/${id}`);
 await expect(page.getByText(`ТРАССА ${id}`,{exact:true})).toBeVisible();
}

export async function solve(page:Page,id:LevelId){
 const response=await page.request.get(`/api/levels/${id}`);
 expect(response.status()).toBe(200);
 const level=levelDTOSchema.parse(await response.json());
 if(level.controls.every(control=>control.mode==='input'))await expect(page.locator('input[type=range]')).toHaveCount(0);
 for(const control of level.controls)await page.locator(`#coefficient-${control.name}`).fill(WITNESSES[id][control.name]!);
 await expect(page.getByRole('button',{name:'▶ Пуск',exact:true})).toBeEnabled();
 return level;
}

export async function completeCurrent(page:Page){
 const saved=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'▶ Пуск',exact:true}).click();
 expect((await saved).status()).toBe(200);
 await expect(page.getByTestId('route-status')).toContainText('Прохождение подтверждено сервером');
}

export async function currentProgress(page:Page){
 const response=await page.request.get('/api/me');
 expect(response.status()).toBe(200);
 return authResponseSchema.parse(await response.json()).progress;
}

export async function expectRobotModelPixels(page:Page,hideMenu=false){
 // Reuse Playwright's exported PNG decoder; no screenshot baseline or new dependency.
 const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle') as {PNG:{sync:{read:(buffer:Buffer)=>{data:Buffer;width:number;height:number}}}};
 const canvas=page.getByRole('figure',{name:'step42 - 3D-компаньон GraphWay',exact:true}).locator('canvas');
 const image=PNG.sync.read(await canvas.screenshot(hideMenu?{style:':has(> [role="dialog"]) { visibility: hidden !important; }'}:{}));
 let bright=0,minX=image.width,maxX=-1,minY=image.height,maxY=-1;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const offset=(y*image.width+x)*4;
  if(image.data[offset]!>170&&image.data[offset+1]!>170&&image.data[offset+2]!>170&&image.data[offset+3]!>0){
   bright++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
 }
 expect(bright/(image.width*image.height),'the white robot body must actually be drawn, not just an empty canvas').toBeGreaterThan(.02);
 expect((maxX-minX)/image.width,'the drawn model must span the canvas horizontally').toBeGreaterThan(.35);
 expect((maxY-minY)/image.height,'the drawn head and body must span the canvas vertically').toBeGreaterThan(.35);
}
