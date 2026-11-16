// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,it,expect,vi } from 'vitest';
import { GraphBoard } from './game/GraphBoard';
import { createGame,gameReducer } from './game/game-state';
import { level } from './test-fixture';
import type { LevelDTO,CoefficientName } from '@graphway/contracts';
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,writable:true});
afterEach(()=>vi.unstubAllGlobals());
it('fills a wide measured viewport without stretching units or shrinking the catalog domain',async()=>{
 let resize:ResizeObserverCallback|undefined;
 vi.stubGlobal('ResizeObserver',class {
  constructor(callback:ResizeObserverCallback){resize=callback;}
  observe(){}
  disconnect(){}
 });
 const host=document.createElement('div');const root=createRoot(host);
 try{
  await act(async()=>root.render(<GraphBoard state={createGame(level)} duration={3000}/>));
  expect(resize).toBeDefined();
  await act(async()=>resize!([{contentRect:{width:800,height:320}} as ResizeObserverEntry],{} as ResizeObserver));
  const svg=host.querySelector('svg')!;
  const [x,y,width,height]=svg.getAttribute('viewBox')!.split(' ').map(Number) as [number,number,number,number];
  expect(x).toBeLessThanOrEqual(-6);
  expect(x+width).toBeGreaterThanOrEqual(6);
  expect(y).toBeLessThanOrEqual(-5.8);
  expect(y+height).toBeGreaterThanOrEqual(1.8);
  expect(width/800).toBeCloseTo(height/320,5);
  const lines=Array.from(svg.querySelectorAll('line'));
  expect(lines.some(line=>Number(line.getAttribute('x1'))< -6)).toBe(true);
  expect(lines.some(line=>Number(line.getAttribute('x2'))>6)).toBe(true);
  const viewport=svg.getAttribute('viewBox');
  await act(async()=>root.render(<GraphBoard state={gameReducer(createGame(level),{type:'edit',name:'b',raw:'6'})} duration={3000}/>));
  expect(svg.getAttribute('viewBox')).toBe(viewport);
 }finally{await act(async()=>root.unmount());}
});
it('keeps zone coordinates readable and removes the old graph after incomplete input',async()=>{
 const host=document.createElement('div');const root=createRoot(host);
 let state=gameReducer(createGame(level),{type:'edit',name:'b',raw:'2'});
 await act(async()=>root.render(<GraphBoard state={state} duration={3000}/>));
 expect(host.querySelector('[data-testid="current-graph"]')).not.toBeNull();
 expect(host.querySelector('figcaption')?.textContent).toContain('S = (−3; −1)');
 state=gameReducer(state,{type:'edit',name:'b',raw:'-'});
 await act(async()=>root.render(<GraphBoard state={state} duration={3000}/>));
 expect(host.querySelector('[data-testid="current-graph"]')).toBeNull();
 expect(host.querySelectorAll('circle').length).toBe(2);
 await act(async()=>root.unmount());
});
it.each(['a','b','c','k'] as CoefficientName[])('removes the graph for every incomplete active coefficient %s',async name=>{
 const quadratic:LevelDTO={...level,id:'Q01',episodeId:'quadratic',functionSpec:{family:'quadratic'},fixed:{},initial:{a:'1',b:'0',c:'0'},controls:[{name:'a',mode:'input'},{name:'b',mode:'input'},{name:'c',mode:'input'}]};
 const linear:LevelDTO={...level,fixed:{b:'0'},initial:{k:'1'},controls:[{name:'k',mode:'input'}]};
 const host=document.createElement('div');const root=createRoot(host);
 const initial=createGame(name==='k'?linear:quadratic);
 await act(async()=>root.render(<GraphBoard state={initial} duration={3000}/>));
 expect(host.querySelector('[data-testid="current-graph"]')).not.toBeNull();
 for(const raw of ['-','1/','']){
  const state=gameReducer(initial,{type:'edit',name,raw});
  await act(async()=>root.render(<GraphBoard state={state} duration={3000}/>));
  expect(host.querySelector('[data-testid="current-graph"]')).toBeNull();
  expect(state.status).toBe('editing-invalid');
  expect(gameReducer(state,{type:'launch'}).snapshot).toBeNull();
 }
 await act(async()=>root.unmount());
});
