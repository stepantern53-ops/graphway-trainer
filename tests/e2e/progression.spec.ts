import { test,expect } from '@playwright/test';
import { register,openLevel,solve,completeCurrent,currentProgress } from './helpers';
import { WITNESSES,type LevelId } from '../../packages/curriculum/tests/witnesses';
import { validateRoute } from '../../packages/math-core/src/index';

test.use({trace:'off',screenshot:'off',video:'off',reducedMotion:'reduce',viewport:{width:1440,height:900}});
test.setTimeout(120_000);

test('progression all 24 linear and quadratic levels, exact conditions, locked access and replay',async({page},testInfo)=>{
 await register(page);
 const navigation=page.getByRole('navigation',{name:'Навигация трассы'});
 await expect(navigation.getByRole('button',{name:'Предыдущий уровень',exact:true})).toBeDisabled();
 await expect(navigation.getByRole('button',{name:'Следующий уровень',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:/ЭПИЗОД 1/}).click();
 const carousel=page.getByRole('region',{name:'Эпизоды'});
 await carousel.focus();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('carousel-linear-1440x900.png'),fullPage:true});
 await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('button',{name:'Эпизод 2: Параболический путь',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Открыть трассы',exact:true})).toBeDisabled();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('carousel-locked-quadratic-1440x900.png'),fullPage:true});
 await page.setViewportSize({width:667,height:375});
 await page.screenshot({path:testInfo.outputPath('carousel-locked-quadratic-667x375.png'),fullPage:true});
 await carousel.focus();
 await page.keyboard.press('ArrowLeft');
 await page.screenshot({path:testInfo.outputPath('carousel-linear-667x375.png'),fullPage:true});
 await page.keyboard.press('ArrowRight');
 const swipeBox=await carousel.boundingBox();
 if(!swipeBox)throw new Error('Episode carousel has no interactive bounds.');
 await page.mouse.move(swipeBox.x+100,swipeBox.y+100);
 await page.mouse.down();
 await page.mouse.move(swipeBox.x+220,swipeBox.y+105,{steps:6});
 await page.mouse.up();
 await expect(page.getByRole('button',{name:'Эпизод 1: Линейный путь',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.setViewportSize({width:1440,height:900});
 expect((await page.request.get('/api/levels/Q01')).status()).toBe(403);
 await page.goto('/#/levels/Q01');
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.locator('#coefficient-a')).toHaveCount(0);
 const ids=Object.keys(WITNESSES) as LevelId[];
 for(const [index,id] of ids.entries()){
  if(index===0)await openLevel(page,id);
  else{
   await page.getByRole('button',{name:'Следующий уровень →',exact:true}).click();
   await expect(page).toHaveURL(new RegExp(`#/levels/${id}$`));
   await expect(page.getByText(`ТРАССА ${id}`,{exact:true})).toBeVisible();
  }
  await expect(navigation.getByRole('button',{name:'Следующий уровень',exact:true})).toBeDisabled();
  const level=await solve(page,id);
  if(id==='L05')await page.locator('#coefficient-k').fill('0,51');
  if(id==='L06')await page.locator('#coefficient-k').fill('0,01');
  if(id==='Q10'){
   const wrongMiddle={a:'2',b:'-3',c:'-1'};
   // f(-1)=4 and f(2)=1, but f(0)=-1. Geometry, including the pit, is safe.
   expect(validateRoute({...level,exactConditions:[{x:-1,y:4},{x:2,y:1}]},wrongMiddle).status).toBe('ready');
   await page.locator('#coefficient-a').fill(wrongMiddle.a);
   await page.locator('#coefficient-b').fill(wrongMiddle.b);
   await page.locator('#coefficient-c').fill(wrongMiddle.c);
   await expect(page.getByRole('button',{name:'▶ Пуск',exact:true})).toBeDisabled();
   await expect(page.getByTestId('current-graph')).toBeVisible();
   await solve(page,id);
  }
  for(const [fixed,value] of Object.entries(level.fixed??{})){
   const field=page.locator(`#coefficient-${fixed}`);
   await expect(field).toHaveValue(String(value));
   await expect(field).toHaveAttribute('readonly','');
  }
  await completeCurrent(page);
  const progress=await currentProgress(page);
  expect(progress.completedCount).toBe(index+1);
  expect(progress.completedLevelIds).toContain(id);
  if(id==='L12')expect(progress.unlockedLevelIds).toContain('Q01');
 }
 await expect(page.getByText('Все трассы пройдены',{exact:true})).toBeVisible();
 await page.setViewportSize({width:667,height:375});
 await page.getByRole('button',{name:'Теория',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Квадратичная функция',exact:true})).toBeVisible();
 await expect(page.locator('.katex-error')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.katex-display').evaluateAll(elements=>elements.some(element=>element.scrollWidth>element.clientWidth+1))).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('quadratic-theory-667x375.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('quadratic-theory-1440x900.png'),fullPage:true});
 await page.getByRole('button',{name:'Вернуться к графику',exact:true}).click();
 await page.getByRole('button',{name:'Выбрать уровень',exact:true}).click();
 await expect(page).toHaveURL(/#\/episodes\/quadratic$/);
 await expect(page.locator('button').filter({hasText:/^Q\d{2}/})).toHaveCount(12);
 await page.reload();
 expect((await currentProgress(page)).completedCount).toBe(24);
 await page.getByRole('button',{name:'GraphWay - главная',exact:true}).click();
 await expect(page.getByText('Пройдено 24 из 24',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'↻ Повторить трассу',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'» Следующий уровень',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'▶ Выбрать эпизод',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Линейный путь',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Параболический путь',exact:true})).toBeVisible();
 await expect(page.getByText('Волновой путь',{exact:false})).toHaveCount(0);
 await page.getByRole('button').filter({has:page.getByRole('heading',{name:'Параболический путь',exact:true})}).click();
 await page.getByRole('button',{name:'Открыть трассы',exact:true}).click();
 await expect(page.locator('button').filter({hasText:/^Q\d{2}/})).toHaveCount(12);
 await openLevel(page,'L01');
 await expect(page.locator('#coefficient-b')).toHaveValue('0');
 await solve(page,'L01');
 await completeCurrent(page);
 const replay=await currentProgress(page);
 expect(replay.completedCount).toBe(24);
 expect(replay.nextLevelId).toBeNull();
 await navigation.getByRole('button',{name:'Следующий уровень',exact:true}).click();
 await expect(page).toHaveURL(/#\/levels\/L02$/);
});
