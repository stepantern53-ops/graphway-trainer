import { test,expect } from '@playwright/test';
import { register,newAccount,expectRobotModelPixels } from './helpers';

test.use({trace:'off',screenshot:'off',video:'off',reducedMotion:'reduce',viewport:{width:1440,height:900}});
test.setTimeout(90_000);

test('responsive orientation keyboard accessibility reduced-motion and no-WebGL remain playable',async({page},testInfo)=>{
 await register(page,{...newAccount(),nickname:'Ш'.repeat(24)});
 const field=page.locator('#coefficient-b');
 await field.fill('2');
 for(const size of [{width:1440,height:900},{width:844,height:390},{width:667,height:375}]){
  await field.blur();
  await page.setViewportSize(size);
  await expect(page.getByTestId('current-graph')).toBeVisible();
  await expect(field).toHaveValue('2');
  const navigation=page.getByRole('navigation',{name:'Навигация трассы'});
  const main=page.getByRole('main',{name:'Игровая трасса'});
  const robot=page.getByRole('complementary',{name:'Робот-напарник'});
  await expect(navigation).toBeVisible();
  await expect(robot).toBeVisible();
  const [navBox,mainBox,robotBox,plotBox]=await Promise.all([navigation.boundingBox(),main.boundingBox(),robot.boundingBox(),page.getByTestId('graph').boundingBox()]);
  expect(navBox&&mainBox&&robotBox&&plotBox).toBeTruthy();
  expect(navBox!.x+navBox!.width).toBeLessThanOrEqual(mainBox!.x);
  expect(mainBox!.x+mainBox!.width).toBeLessThanOrEqual(robotBox!.x);
  expect(plotBox!.width).toBeGreaterThan(mainBox!.width*.8);
  const formula=await page.locator('[aria-label="Формула функции"]').boundingBox();
  const controls=await page.getByRole('group',{name:'Коэффициенты функции'}).boundingBox();
  expect(formula!.y).toBeGreaterThanOrEqual(plotBox!.y+plotBox!.height);
  expect(controls!.y).toBeGreaterThan(formula!.y);
  for(const zone of ['start-zone','goal-zone']){
   const circle=await page.getByTestId(zone).boundingBox();
   expect(Math.abs(circle!.width-circle!.height)).toBeLessThan(.5);
  }
  const grid=await page.getByTestId('graph').evaluate(svg=>{
   const box=svg.getBoundingClientRect();
   const lines=Array.from(svg.querySelectorAll('line')).map(line=>line.getBoundingClientRect());
   return {left:Math.min(...lines.map(line=>line.left))-box.left,right:box.right-Math.max(...lines.map(line=>line.right))};
  });
  expect(grid.left).toBeLessThan(28);expect(grid.right).toBeLessThan(28);
  const labels=await page.getByTestId('graph').evaluate(svg=>Array.from(svg.querySelectorAll('text[text-anchor="middle"]')).filter(text=>/^-?\d+$/.test(text.textContent??'')).map(text=>{const box=text.getBoundingClientRect();return {left:box.left,right:box.right};}).sort((a,b)=>a.left-b.left));
  expect(labels.length).toBeGreaterThan(2);
  for(let index=1;index<labels.length;index++)expect(labels[index]!.left-labels[index-1]!.right).toBeGreaterThanOrEqual(3);
  const fixed=page.locator('#coefficient-k');
  await expect(fixed).toHaveValue('1');
  await expect(fixed).toHaveAttribute('readonly','');
  await fixed.focus();
  await page.keyboard.press('9');
  await expect(fixed).toHaveValue('1');
  const fieldSizes=await Promise.all([fixed,field].map(input=>input.evaluate(element=>({height:element.getBoundingClientRect().height,font:parseFloat(getComputedStyle(element).fontSize)}))));
  expect(fieldSizes[0]!.height).toBe(fieldSizes[1]!.height);
  expect(fieldSizes[0]!.font).toBe(fieldSizes[1]!.font);
  expect(fieldSizes[0]!.font).toBeGreaterThanOrEqual(14);
  for(const action of await navigation.getByRole('button').all()){
   const target=await action.boundingBox();expect(target!.height).toBeGreaterThanOrEqual(44);
  }
  const launch=page.getByRole('button',{name:'▶ Пуск',exact:true});
  await launch.scrollIntoViewIfNeeded();
  await expect(launch).toBeEnabled();
  const box=await launch.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Теория',exact:true}).click();
  await expect(page.getByRole('button',{name:'Вернуться к графику'})).toBeVisible();
  await page.getByRole('button',{name:'Вернуться к графику'}).click();
  await expect(field).toHaveValue('2');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath(`game-${size.width}x${size.height}.png`),fullPage:true});
 }
 await page.getByRole('button',{name:'Теория',exact:true}).click();
 await page.setViewportSize({width:1440,height:900});
 await expectRobotModelPixels(page);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('paused-theory-resize-1440x900.png'),fullPage:true});
 await page.getByRole('button',{name:'Вернуться к графику',exact:true}).click();
 await page.getByRole('button',{name:'☰ Меню трассы',exact:true}).click();
 await page.setViewportSize({width:667,height:375});
 // Exclude only the modal overlay from the capture; game/menu/paused state is unchanged.
 await expectRobotModelPixels(page,true);
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 await page.setViewportSize({width:844,height:390});
 await field.focus();
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('heading',{name:'Поверни устройство',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'▶ Пуск',exact:true})).toBeHidden();
 await page.setViewportSize({width:844,height:390});
 await expect(field).toHaveValue('2');
 await field.focus();
 await page.setViewportSize({width:844,height:220});
 await expect(field).toHaveValue('2');
 await expect(page.getByRole('heading',{name:'Поверни устройство',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:844,height:390});
 await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>{const element=document.activeElement;return element instanceof HTMLElement&&getComputedStyle(element).outlineStyle!=='none';})).toBe(true);
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:function(this:HTMLCanvasElement,kind:string,...args:unknown[]){
   if(kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl')return null;
   return Reflect.apply(original,this,[kind,...args]);
  }});
 });
 await page.setViewportSize({width:1440,height:900});
 await page.reload();
 await expect(page.getByAltText('step42 - белый округлый робот с фиолетовыми глазами на платформе')).toBeVisible();
 await expect(page.getByText('Статичный 3D-рендер · игра доступна',{exact:true})).toBeVisible();
 expect(await page.getByAltText('step42 - белый округлый робот с фиолетовыми глазами на платформе').evaluate(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0)).toBe(true);
 await field.fill('2');
 const began=Date.now();
 const saved=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'▶ Пуск',exact:true}).click();
 expect((await saved).status()).toBe(200);
 expect(Date.now()-began).toBeGreaterThanOrEqual(450);
 await expect(page.getByTestId('route-status')).toContainText('Прохождение подтверждено сервером');
 await page.screenshot({path:testInfo.outputPath('no-webgl-confirmed.png'),fullPage:true});
 await page.getByRole('button',{name:'GraphWay - главная',exact:true}).click();
 await expect(page.getByText('Пройдено 1 из 24',{exact:true})).toBeVisible();
 const choose=await page.getByRole('button',{name:'▶ Выбрать эпизод',exact:true}).boundingBox();
 const next=await page.getByRole('button',{name:'» Следующий уровень',exact:true}).boundingBox();
 expect(choose&&next&&choose.x<next.x).toBe(true);
 await page.screenshot({path:testInfo.outputPath('home-desktop.png'),fullPage:true});
});
