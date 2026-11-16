// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,describe,it,expect,vi } from 'vitest';
import { GameScreen } from './game/GameScreen';
import { createGame,gameReducer } from './game/game-state';
import { level } from './test-fixture';
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,writable:true});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('completion request lifecycle',()=>{
 it('starts POST only after arrival and cancels late consumer updates after leaving',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
  const pending:{resolve?:(response:Response)=>void}={};
  const fetch=vi.spyOn(globalThis,'fetch')
   .mockResolvedValueOnce(new Response(JSON.stringify({csrfToken:'test-token'}),{status:200}))
   .mockImplementationOnce(()=>new Promise<Response>(resolve=>{pending.resolve=resolve;}));
  let state=gameReducer(createGame(level),{type:'edit',name:'b',raw:'2'});
  state=gameReducer(state,{type:'launch'});
  const host=document.createElement('div');const root=createRoot(host);const saved=vi.fn();const dispatch=vi.fn();
  const render=()=>root.render(<GameScreen state={state} owner="aabbccdd-1122-4333-8444-112233445566" dispatch={dispatch} portrait={false} onSaved={saved} onUnauthorized={()=>{}} onSessionChanged={()=>{}} onHome={()=>{}} onEpisodes={()=>{}} onEpisodePicker={()=>{}} previous={null} next={null} allPassed={false} onLevel={()=>{}}/>);
  await act(async()=>render());
  expect(fetch).not.toHaveBeenCalled();
  state=gameReducer(state,{type:'tick',delta:3000,duration:3000});
  await act(async()=>render());
  const posts=fetch.mock.calls.filter(([url,init])=>String(url).endsWith('/api/levels/L01/complete')&&init?.method==='POST');
  expect(posts).toHaveLength(1);
  expect(JSON.parse(String(posts[0]![1]!.body))).toEqual({curriculumVersion:'graphway-v1',coefficients:{b:'2'}});
  const resolve=pending.resolve;
  if(!resolve)throw new Error('Arrival did not start the deferred completion request.');
  expect(saved).not.toHaveBeenCalled();
  await act(async()=>root.unmount());
  dispatch.mockClear();
  await act(async()=>resolve(new Response(JSON.stringify({completion:{levelId:'L01',curriculumVersion:'graphway-v1',completedAt:'2026-11-16T00:00:00.000Z'},progress:{curriculumVersion:'graphway-v1',currentLevelId:'L02',nextLevelId:'L02',completedLevelIds:['L01'],unlockedLevelIds:['L01','L02'],completedCount:1,totalCount:24}}),{status:200})));
  expect(saved).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
 });
});

it.each(['Escape','Continue'])('restores keyboard focus to the menu opener after %s',async action=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<GameScreen state={createGame(level)} owner="aabbccdd-1122-4333-8444-112233445566" dispatch={()=>{}} portrait={false} onSaved={()=>{}} onUnauthorized={()=>{}} onSessionChanged={()=>{}} onHome={()=>{}} onEpisodes={()=>{}} onEpisodePicker={()=>{}} previous={null} next={null} allPassed={false} onLevel={()=>{}}/>));
  const opener=host.querySelector<HTMLButtonElement>('button[aria-label="☰ Меню трассы"]');
  if(!opener)throw new Error('Menu opener is missing.');
  await act(async()=>{opener.focus();opener.click();});
  const dialog=host.querySelector('[role=dialog]');
  if(!dialog)throw new Error('Menu did not open.');
  expect(dialog.contains(document.activeElement)).toBe(true);
  await act(async()=>{
   if(action==='Escape')dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   else dialog.querySelector('button')!.click();
  });
  expect(host.querySelector('[role=dialog]')).toBeNull();
  expect(document.activeElement).toBe(opener);
 }finally{await act(async()=>root.unmount());host.remove();}
});
