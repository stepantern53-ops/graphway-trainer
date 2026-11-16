// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { GameScreen } from './game/GameScreen';
import { TheoryPanel } from './game/TheoryPanel';
import { CurrentFormula } from './game/CoefficientControls';
import { createGame,gameReducer } from './game/game-state';
import { level } from './test-fixture';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('keeps a valid manual-input route launchable while robot help can be skipped and reopened without edits',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const dispatch=vi.fn();
 const manual={...level,controls:[{name:'b' as const,mode:'input' as const}]};
 const state=gameReducer(createGame(manual),{type:'edit',name:'b',raw:'2'});
 try{
  await act(async()=>root.render(<GameScreen state={state} owner="coach_manual_consumer" dispatch={dispatch} portrait={false} onSaved={()=>{}} onUnauthorized={()=>{}} onSessionChanged={()=>{}} onHome={()=>{}} onEpisodes={()=>{}} onEpisodePicker={()=>{}} previous={null} next={null} allPassed={false} onLevel={()=>{}}/>));
  const launch=host.querySelector<HTMLButtonElement>('button[aria-label="▶ Пуск"]');
  expect(launch?.disabled).toBe(false);
  const skip=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Пропустить');
  await act(async()=>skip?.click());
  expect(host.querySelector('[aria-label="Подсказки робота"]')).toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Как играть — подсказки робота"]')?.click());
  const coach=host.querySelector('[aria-label="Подсказки робота"]');
  expect(coach).not.toBeNull();
  await act(async()=>coach?.querySelector<HTMLButtonElement>('[data-next]')?.click());
  await act(async()=>coach?.querySelector<HTMLButtonElement>('[data-next]')?.click());
  expect(host.querySelector('input[type="range"]')).toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Закрыть подсказки"]')?.click());
  expect(host.querySelector<HTMLInputElement>('#coefficient-b')?.value).toBe('2');
  expect(launch?.disabled).toBe(false);
  expect(dispatch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('illustrates only the learner function and removes its curve for incomplete input without losing curriculum',async()=>{
 const host=document.createElement('div');const root=createRoot(host);
 try{
  await act(async()=>root.render(<TheoryPanel level={level} raw={{b:'2'}} onClose={()=>{}}/>));
  expect(host.querySelectorAll('[data-testid="theory-current-curve"]').length).toBeGreaterThan(0);
  await act(async()=>root.render(<TheoryPanel level={level} raw={{b:'-'}} onClose={()=>{}}/>));
  expect(host.querySelectorAll('[data-testid="theory-current-curve"]').length).toBe(0);
 }finally{await act(async()=>root.unmount());}
});

it('renders actual fraction and fixed formula chips and preserves incomplete raw text instead of an old number',async()=>{
 const host=document.createElement('div');const root=createRoot(host);
 const linear={...level,controls:[{name:'k' as const,mode:'input' as const}],fixed:{b:'0'},initial:{k:'1'}};
 try{
  await act(async()=>root.render(<CurrentFormula level={linear} raw={{k:'1/2'}}/>));
  expect(host.textContent).toContain('1/2');
  expect(host.textContent).toContain('0');
  await act(async()=>root.render(<CurrentFormula level={linear} raw={{k:'1/'}}/>));
  expect(host.textContent).toContain('1/');
  expect(host.textContent).not.toContain('1/2');
  expect(host.querySelector('[data-valid=false]')).not.toBeNull();
 }finally{await act(async()=>root.unmount());}
});
