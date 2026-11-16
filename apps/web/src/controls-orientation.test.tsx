// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe,it,expect } from 'vitest';
import { CoefficientControls } from './game/CoefficientControls';
import { stablePortrait } from './layout/orientation';
import { level } from './test-fixture';
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,writable:true});

describe('orientation consumer',()=>{
 it('uses device orientation rather than keyboard viewport dimensions',()=>{
  expect(stablePortrait({type:'landscape-primary',width:844,height:200,previous:false,editing:true})).toBe(false);
  expect(stablePortrait({width:390,height:200,previous:true,editing:true})).toBe(true);
  expect(stablePortrait({type:'portrait-primary',width:390,height:844,previous:false,editing:false})).toBe(true);
 });
});
describe('coefficient controls consumer',()=>{
 it('shows exact raw fractions and fixed coefficients without rounding the field',async()=>{
  const host=document.createElement('div'); const root=createRoot(host);
  await act(async()=>root.render(<CoefficientControls level={level} raw={{b:'-3/2'}} disabled={false} onEdit={()=>{}}/>));
  expect(host.querySelector<HTMLInputElement>('#coefficient-b')?.value).toBe('-3/2');
  const fixed=host.querySelector<HTMLInputElement>('#coefficient-k');
  expect(fixed?.value).toBe('1');
  expect(fixed?.readOnly||fixed?.disabled).toBe(true);
  expect(fixed?.getAttribute('aria-describedby')).toBeTruthy();
  await act(async()=>root.unmount());
 });
 it('does not render sliders for exact input-only controls',async()=>{
  const host=document.createElement('div');const root=createRoot(host);
  await act(async()=>root.render(<CoefficientControls level={{...level,controls:[{name:'b',mode:'input'}]}} raw={{b:'0'}} disabled onEdit={()=>{}}/>));
  expect(host.querySelector('input[type="range"]')).toBeNull();
  expect(host.querySelector<HTMLInputElement>('input[type="text"]')?.matches(':disabled')).toBe(true);
  await act(async()=>root.unmount());
 });
 it('shows the quadratic leading coefficient lower magnitude bound before any error',async()=>{
  const host=document.createElement('div');const root=createRoot(host);
  await act(async()=>root.render(<CoefficientControls level={{...level,functionSpec:{family:'quadratic'},fixed:{b:'0',c:'0'},controls:[{name:'a',mode:'input'}]}} raw={{a:'1'}} disabled={false} onEdit={()=>{}}/>));
  expect(host.textContent).toContain('|a| ≥ 1/8');
  await act(async()=>root.unmount());
 });
});
