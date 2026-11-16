// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,it,expect,vi } from 'vitest';
import { App } from './app/App';
import { level } from './test-fixture';
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,writable:true});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();location.hash='';});

it.each([401,503])('explicit logout handles HTTP %s without retaining a dead identity or hiding a real failure',async status=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const progress={curriculumVersion:'graphway-v1',currentLevelId:'L01',nextLevelId:'L01',completedLevelIds:[],unlockedLevelIds:['L01'],completedCount:0,totalCount:24};
 const session={user:{id:'aabbccdd-1122-4333-8444-112233445566',nickname:'student_unit',role:'student'},progress};
 const response=(body:unknown,httpStatus=200)=>new Response(JSON.stringify(body),{status:httpStatus});
 vi.spyOn(globalThis,'fetch').mockImplementation(async path=>{
  if(String(path).endsWith('/auth/logout'))return response({error:{code:status===401?'UNAUTHENTICATED':'UNAVAILABLE',message:'Сервер недоступен для выхода.'}},status);
  if(String(path).endsWith('/auth/csrf'))return response({csrfToken:'unit-csrf'});
  if(String(path).endsWith('/episodes'))return response({episodes:[{id:'linear',title:'Линейный путь',totalCount:1,completedCount:0,unlocked:true},{id:'quadratic',title:'Параболический путь',totalCount:0,completedCount:0,unlocked:false}]});
  if(String(path).includes('/episodes/'))return response({levels:String(path).includes('/linear/')?[{id:'L01',title:level.title,focus:level.focus,goal:level.goal,completed:false,unlocked:true}]:[]});
  if(String(path).endsWith('/levels/L01'))return response(level);
  if(String(path).endsWith('/progress/current'))return response(progress);
  return response(session);
 });
 location.hash='/levels/L01';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));
  const field=host.querySelector<HTMLInputElement>('#coefficient-b');
  if(!field)throw new Error('Initial game did not load.');
  await act(async()=>{
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'2');
   field.dispatchEvent(new Event('input',{bubbles:true}));
  });
  expect(field.value).toBe('2');
  const profile=Array.from(host.querySelectorAll('button')).find(button=>button.textContent?.includes('student_unit'));
  if(!profile)throw new Error('Authenticated profile opener is missing.');
  await act(async()=>profile.click());
  const logout=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Выйти из аккаунта');
  if(!logout)throw new Error('Logout action is missing.');
  await act(async()=>logout.click());
  if(status===401){
   expect(host.querySelector('#password')).not.toBeNull();
   expect(host.querySelector('#coefficient-b')).toBeNull();
   expect(host.textContent).not.toContain('student_unit');
   const login=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Вход');
   if(!login)throw new Error('Login tab is missing.');
   await act(async()=>login.click());
   await act(async()=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
    setter.call(host.querySelector('#nickname'),'student_unit');
    host.querySelector('#nickname')!.dispatchEvent(new Event('input',{bubbles:true}));
    setter.call(host.querySelector('#password'),'unit-only-password');
    host.querySelector('#password')!.dispatchEvent(new Event('input',{bubbles:true}));
   });
   await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   expect(host.querySelector<HTMLInputElement>('#coefficient-b')?.value).toBe('0');
  }else{
   expect(host.querySelector('#password')).toBeNull();
   expect(host.textContent).toContain('Сервер недоступен для выхода.');
   expect(host.textContent).toContain('student_unit');
   const retry=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Повторить');
   if(!retry)throw new Error('The honest server error has no retry action.');
   await act(async()=>retry.click());
   expect(host.querySelector<HTMLInputElement>('#coefficient-b')?.value).toBe('2');
  }
 }finally{await act(async()=>root.unmount());host.remove();}
});

it.each(['level','current'] as const)('leaving an in-flight %s request releases Home/Episodes without cancelling newer loading ownership',async pendingStage=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const progress={curriculumVersion:'graphway-v1',currentLevelId:'L01',nextLevelId:'L02',completedLevelIds:['L01'],unlockedLevelIds:['L01','L02'],completedCount:1,totalCount:24};
 const session={user:{id:'aabbccdd-1122-4333-8444-112233445566',nickname:'student_navigation',role:'student'},progress};
 const deferred:{old?:(response:Response)=>void;newer?:(response:Response)=>void}={};
 const response=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
 vi.spyOn(globalThis,'fetch').mockImplementation(async(path,init)=>{
  const url=String(path);
  if(url.endsWith('/auth/csrf'))return response({csrfToken:'navigation-csrf'});
  if(url.endsWith('/levels/L01'))return pendingStage==='level'?new Promise<Response>(resolve=>{deferred.old=resolve;}):response(level);
  if(url.endsWith('/levels/L02'))return new Promise<Response>(resolve=>{deferred.newer=resolve;});
  if(url.endsWith('/progress/current')){
   const body=JSON.parse(String(init?.body)) as {levelId:string};
   return pendingStage==='current'&&body.levelId==='L01'?new Promise<Response>(resolve=>{deferred.old=resolve;}):response({...progress,currentLevelId:body.levelId});
  }
  if(url.endsWith('/episodes'))return response({episodes:[{id:'linear',title:'Линейный путь',totalCount:12,completedCount:1,unlocked:true},{id:'quadratic',title:'Параболический путь',totalCount:12,completedCount:0,unlocked:false}]});
  if(url.includes('/episodes/'))return response({levels:url.includes('/linear/')?['L01','L02'].map(id=>({id,title:id,focus:'Навык',goal:'Цель',completed:id==='L01',unlocked:true})):[]});
  return response(session);
 });
 history.replaceState(null,'','#/levels/L01');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));
  const finishOld=deferred.old;
  if(!finishOld)throw new Error('The original game request was not pending.');
  expect(host.textContent).toContain('Загружаем трассу…');
  await act(async()=>{history.replaceState(null,'','#/home');window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(host.textContent).toContain('Пройдено 1 из 24');
  expect(host.textContent).not.toContain('Загружаем трассу…');
  await act(async()=>{history.replaceState(null,'','#/episodes');window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(host.querySelector('h1')?.textContent).toBe('Выбери эпизод');
  expect(host.textContent).toContain('Линейный путь');
  expect(host.textContent).not.toContain('Загружаем трассу…');
  await act(async()=>{history.replaceState(null,'','#/levels/L02');window.dispatchEvent(new HashChangeEvent('hashchange'));});
  const finishNewer=deferred.newer;
  if(!finishNewer)throw new Error('The newer game request was not pending.');
  expect(host.textContent).toContain('Загружаем трассу…');
  await act(async()=>finishOld(response(pendingStage==='level'?level:{...progress,currentLevelId:'L01',completedCount:0})));
  expect(location.hash).toBe('#/levels/L02');
  expect(host.textContent).toContain('Загружаем трассу…');
  expect(host.querySelector('#coefficient-b')).toBeNull();
  expect(host.textContent).toContain('1 / 24 трасс');
  await act(async()=>finishNewer(response({...level,id:'L02',title:'Новая трасса',initial:{b:'1'}})));
  expect(host.querySelector('h1')?.textContent).toBe('Новая трасса');
  expect(host.querySelector<HTMLInputElement>('#coefficient-b')?.value).toBe('1');
  expect(host.textContent).not.toContain('Загружаем трассу…');
 }finally{await act(async()=>root.unmount());host.remove();}
});
