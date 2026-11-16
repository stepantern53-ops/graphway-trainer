// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,it,expect,vi } from 'vitest';
import { OrientationGate } from './layout/OrientationGate';
import { usePortrait,stablePortrait } from './layout/orientation';
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,writable:true});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function Subject(){const portrait=usePortrait();return <OrientationGate portrait={portrait}><input aria-label="coefficient" defaultValue="-3/2"/></OrientationGate>;}

it('does not mistake a focused width-changing rotation for keyboard-only height resize',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 let width=844;let height=390;
 vi.spyOn(document.documentElement,'clientWidth','get').mockImplementation(()=>width);
 vi.spyOn(document.documentElement,'clientHeight','get').mockImplementation(()=>height);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<Subject/>));
  const input=host.querySelector('input')!;
  await act(async()=>input.focus());
  height=240;
  await act(async()=>window.dispatchEvent(new Event('resize')));
  expect(host.querySelector('h1')).toBeNull();
  width=390;height=844;
  await act(async()=>window.dispatchEvent(new Event('resize')));
  expect(host.querySelector('h1')?.textContent).toBe('Поверни устройство');
  expect(input.value).toBe('-3/2');
  expect(host.querySelector('input')).toBe(input);
  width=844;height=390;
  await act(async()=>window.dispatchEvent(new Event('resize')));
  expect(host.querySelector('h1')).toBeNull();
  expect(input.value).toBe('-3/2');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('recomputes fallback orientation on blur without requiring another resize',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 let height=390;
 vi.spyOn(document.documentElement,'clientWidth','get').mockReturnValue(844);
 vi.spyOn(document.documentElement,'clientHeight','get').mockImplementation(()=>height);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<Subject/>));
  const input=host.querySelector('input')!;
  await act(async()=>input.focus());
  height=900;
  await act(async()=>window.dispatchEvent(new Event('resize')));
  expect(host.querySelector('h1')).toBeNull();
  await act(async()=>input.blur());
  expect(host.querySelector('h1')?.textContent).toBe('Поверни устройство');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('keeps actual device orientation authoritative over keyboard viewport shape',()=>{
 expect(stablePortrait({type:'landscape-primary',width:390,height:844,previous:false,editing:true})).toBe(false);
});
