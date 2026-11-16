// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { App } from './app/App';
import { EpisodeScreen } from './episodes/EpisodeScreen';
import { level } from './test-fixture';
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,writable:true});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();history.replaceState(null,'','#');});
const ids=['L01','L02','L12','Q01','Q12'];
const episodes=[{id:'linear',title:'Линейный путь',totalCount:3,completedCount:0,unlocked:true},{id:'quadratic',title:'Параболический путь',totalCount:2,completedCount:0,unlocked:false}];
const response=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
const button=(host:HTMLElement,name:string)=>Array.from(host.querySelectorAll('button')).find(item=>item.getAttribute('aria-label')===name||item.textContent?.trim().endsWith(name));

it.each<{current:string;completed:string[];unlocked:string[];next:string;role:'student'|'admin';target:string|null}>([
 {current:'L01',completed:[],unlocked:['L01'],next:'L01',role:'student',target:null},
 {current:'L01',completed:['L01','L02'],unlocked:['L01','L02','L12'],next:'L12',role:'student',target:'L02'},
 {current:'L12',completed:['L01','L02','L12'],unlocked:['L01','L02','L12','Q01'],next:'Q01',role:'student',target:'Q01'},
 {current:'L12',completed:[],unlocked:ids,next:'L01',role:'admin',target:'Q01'}
])('uses catalog adjacency rather than first-uncompleted from $current ($role)',async scenario=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const progress={curriculumVersion:'graphway-v1',currentLevelId:scenario.current,nextLevelId:scenario.next,completedLevelIds:scenario.completed,unlockedLevelIds:scenario.unlocked,completedCount:scenario.completed.length,totalCount:5};
 vi.spyOn(globalThis,'fetch').mockImplementation(async(path,init)=>{
  const url=String(path);
  if(url.endsWith('/auth/csrf'))return response({csrfToken:'navigation-token'});
  if(url.endsWith('/episodes'))return response({episodes});
  if(url.includes('/episodes/'))return response({levels:ids.filter(id=>id.startsWith(url.includes('/linear/')?'L':'Q')).map(id=>({id,title:id,focus:'Навык',goal:'Цель',completed:scenario.completed.includes(id),unlocked:scenario.unlocked.includes(id)}))});
  if(url.endsWith('/progress/current'))return response({...progress,currentLevelId:JSON.parse(String(init?.body)).levelId});
  if(url.includes('/levels/')){const id=url.split('/').at(-1)!;return response({...level,id,episodeId:id.startsWith('L')?'linear':'quadratic'});}
  return response({user:{id:'aabbccdd-1122-4333-8444-112233445566',nickname:'navigation_student',role:scenario.role},progress});
 });
 history.replaceState(null,'',`#/levels/${scenario.current}`);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));
  const nav=host.querySelector<HTMLElement>('nav[aria-label="Навигация трассы"]');
  expect(nav).not.toBeNull();
  const previous=button(nav!,'Предыдущий уровень');
  if(scenario.current==='L01')expect(previous?.disabled).toBe(true);
  const next=button(nav!,'Следующий уровень');
  expect(next?.disabled).toBe(scenario.target===null);
  await act(async()=>next?.click());
  await act(async()=>{window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(location.hash).toBe(`#/levels/${scenario.target??scenario.current}`);
  const home=button(host.querySelector<HTMLElement>('nav[aria-label="Навигация трассы"]')!,'На главную');
  await act(async()=>home?.click());
  await act(async()=>{window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(location.hash).toBe('#/home');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('shows completed Q12 endpoint and opens selection instead of an invented neighbor',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const progress={curriculumVersion:'graphway-v1',currentLevelId:'Q12',nextLevelId:null,completedLevelIds:ids,unlockedLevelIds:ids,completedCount:5,totalCount:5};
 vi.spyOn(globalThis,'fetch').mockImplementation(async path=>{
  const url=String(path);
  if(url.endsWith('/auth/csrf'))return response({csrfToken:'end-token'});
  if(url.endsWith('/episodes'))return response({episodes:episodes.map(item=>({...item,unlocked:true}))});
  if(url.includes('/episodes/'))return response({levels:ids.filter(id=>id.startsWith(url.includes('/linear/')?'L':'Q')).map(id=>({id,title:id,focus:'Навык',goal:'Цель',completed:true,unlocked:true}))});
  if(url.endsWith('/levels/Q12'))return response({...level,id:'Q12',episodeId:'quadratic'});
  if(url.endsWith('/progress/current'))return response(progress);
  return response({user:{id:'aabbccdd-1122-4333-8444-112233445566',nickname:'completed_student',role:'student'},progress});
 });
 history.replaceState(null,'','#/levels/Q12');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));
  expect(host.textContent).toContain('Все трассы пройдены');
  const select=button(host,'Выбрать уровень');expect(select).toBeDefined();
  await act(async()=>select!.click());
  await act(async()=>{window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(location.hash).toBe('#/episodes/quadratic');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('lets keyboard and swipe inspect a locked episode without opening it',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(response({episodes}));
 const open=vi.fn();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<EpisodeScreen episodeId={null} onSelect={open} onOpen={()=>{}} onBack={()=>{}} onUnauthorized={()=>{}}/>));
  const carousel=host.querySelector<HTMLElement>('[aria-roledescription="карусель"]');expect(carousel).not.toBeNull();
  const active=()=>host.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
  expect(active()?.textContent).toContain('Линейный путь');
  vi.useFakeTimers();
  await act(async()=>{vi.advanceTimersByTime(60_000);});
  vi.useRealTimers();
  expect(active()?.textContent).toContain('Линейный путь');
  await act(async()=>{carousel!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));});
  expect(active()?.textContent).toContain('Параболический путь');
  expect(button(host,'Открыть трассы')?.disabled).toBe(true);
  await act(async()=>active()?.click());expect(open).not.toHaveBeenCalled();
  await act(async()=>{
   carousel!.dispatchEvent(new MouseEvent('pointerdown',{clientX:100,clientY:50,bubbles:true}));
   carousel!.dispatchEvent(new MouseEvent('pointerup',{clientX:220,clientY:55,bubbles:true}));
  });
  expect(active()?.textContent).toContain('Линейный путь');
  await act(async()=>button(host,'Открыть трассы')?.click());
  expect(open).toHaveBeenCalledWith('linear');
 }finally{await act(async()=>root.unmount());host.remove();}
});
