// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import Step42Scene from './Step42Scene.js';

beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
afterAll(() => vi.unstubAllGlobals());

it('keeps real controls usable when WebGL is absent and exposes the same-model static fallback', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  function Consumer() {
    const [value, setValue] = useState(0);
    return <><Step42Scene mood="idle" reducedMotion active={false} /><button onClick={() => setValue(value + 1)}>Коэффициент {value}</button></>;
  }
  await act(async () => root.render(<Consumer />));
  const image = host.querySelector('img');
  expect(image?.alt).toContain('step42');
  expect(host.textContent).toContain('Статичный 3D-рендер');
  expect(host.querySelector('canvas')).toBeNull();
  const reaction=host.querySelector<HTMLButtonElement>('button[aria-label="Поздороваться с роботом step42"]');
  expect(reaction?.disabled).toBe(true);
  const coefficient=Array.from(host.querySelectorAll('button')).find(button=>button.textContent?.startsWith('Коэффициент '));
  expect(coefficient?.disabled).toBe(false);
  await act(async () => coefficient!.click());
  expect(coefficient!.textContent).toBe('Коэффициент 1');
  await act(async () => root.unmount());
  host.remove();
});
