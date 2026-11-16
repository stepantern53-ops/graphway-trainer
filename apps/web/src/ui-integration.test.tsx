// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { HomeScreen } from './home/HomeScreen';
import { GameScreen } from './game/GameScreen';
import { createGame } from './game/game-state';
import { level } from './test-fixture';
import type { ProgressDTO,SafeUser } from '@graphway/contracts';
const progress:ProgressDTO={curriculumVersion:'graphway-v1',currentLevelId:'L01',nextLevelId:'L01',completedLevelIds:[],unlockedLevelIds:['L01'],completedCount:0,totalCount:24};
const user:SafeUser={id:'aabbccdd-1122-4333-8444-112233445566',nickname:'student_design',role:'student'};
const expired=()=>new Response(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'Сессия завершилась'}}),{status:401});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('surfaces a current home catalog expiry through the real authentication boundary',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(expired());
 const unauthorized=vi.fn();const host=document.createElement('div');const root=createRoot(host);
 try{
  await act(async()=>root.render(<HomeScreen user={user} progress={progress} onEpisodes={()=>{}} onNext={()=>{}} onUnauthorized={unauthorized}/>));
  expect(unauthorized).toHaveBeenCalledOnce();
  expect(host.querySelector('[role=alert]')?.textContent).toContain('Сессия завершилась');
 }finally{await act(async()=>root.unmount());}
});
it('does not reauthenticate a departed home consumer when its pending catalog request expires',async()=>{
 // ES2022 project library does not expose Promise.withResolvers.
 let release:((response:Response)=>void)|undefined;
 vi.spyOn(globalThis,'fetch').mockImplementation(()=>new Promise<Response>(resolve=>{release=resolve;}));
 const unauthorized=vi.fn();const host=document.createElement('div');const root=createRoot(host);
 await act(async()=>root.render(<HomeScreen user={user} progress={progress} onEpisodes={()=>{}} onNext={()=>{}} onUnauthorized={unauthorized}/>));
 await act(async()=>root.unmount());
 await act(async()=>release?.(expired()));
 expect(unauthorized).not.toHaveBeenCalled();
});
it('exits the expanded graph with Escape without editing coefficients or starting a ride',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const dispatch=vi.fn();
 try{
  await act(async()=>root.render(<GameScreen state={createGame(level)} owner={user.id} dispatch={dispatch} portrait={false} onSaved={()=>{}} onUnauthorized={()=>{}} onSessionChanged={()=>{}} onHome={()=>{}} onEpisodes={()=>{}} onEpisodePicker={()=>{}} previous={null} next={null} allPassed={false} onLevel={()=>{}}/>));
  const button=host.querySelector<HTMLButtonElement>('button[aria-label="График на весь экран"]');
  if(!button)throw new Error('Expanded graph control is unavailable.');
  await act(async()=>button.click());
  expect(button.getAttribute('aria-pressed')).toBe('true');
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(document.activeElement).toBe(button);
  expect(host.querySelector<HTMLInputElement>('#coefficient-b')?.value).toBe('0');
  expect(dispatch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
