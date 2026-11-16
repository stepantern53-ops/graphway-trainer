import { parseCoefficient } from '@graphway/math-core';
import type { CoefficientName } from '@graphway/math-core';
import type { LevelDTO } from '@graphway/contracts';
import type { GameState, RawFields } from './game-state';

/** Цвет = роль коэффициента (только оформление): высота на оси y, наклон/форма, ось и вершина. */
export type Role = 'height' | 'shape' | 'axis';
export function roleOf(family: 'linear' | 'quadratic', name: CoefficientName): Role {
  if (family === 'linear') return name === 'k' ? 'shape' : 'height';
  return name === 'a' ? 'shape' : name === 'b' ? 'axis' : 'height';
}
const ROLE_COLOR: Record<Role, string> = { height: '#6538b7', shape: '#1c1530', axis: '#8f68dc' };
export function formulaTex(family: 'linear' | 'quadratic') {
  const c = (n: CoefficientName) => `\\textcolor{${ROLE_COLOR[roleOf(family, n)]}}{${n}}`;
  return family === 'linear' ? `y=${c('k')}x+${c('b')}` : `y=${c('a')}x^2+${c('b')}x+${c('c')}`;
}

const boundsFor = (level: LevelDTO, name: CoefficientName) => level.bounds?.[name] ?? { min: -6, max: 6, ...(name === 'a' ? { minAbs: '1/8' } : {}) };
/** Текущая функция словами «y = x + 2» из введённых чисел (ничего не вычисляет для проверки). */
export function prettyFunction(level: LevelDTO, raw: RawFields): string | null {
  const names = level.functionSpec.family === 'linear' ? (['k', 'b'] as const) : (['a', 'b', 'c'] as const);
  const parts: { value: number; text: string; power: string }[] = [];
  for (const name of names) {
    const text = level.fixed?.[name] !== undefined && !level.controls.some(c => c.name === name) ? String(level.fixed[name]) : raw[name] ?? String(level.fixed?.[name] ?? '');
    const parsed = parseCoefficient(text, boundsFor(level, name));
    if (parsed.status !== 'valid') return null;
    const power = level.functionSpec.family === 'linear' ? (name === 'k' ? 'x' : '') : name === 'a' ? 'x²' : name === 'b' ? 'x' : '';
    parts.push({ value: parsed.numeric, text: text.trim().replace(/^[-−]/, '').replace(/^\+/, ''), power });
  }
  let out = '';
  for (const { value, text, power } of parts) {
    if (value === 0) continue;
    const sign = value < 0 ? (out ? ' − ' : '−') : (out ? ' + ' : '');
    const magnitude = power && Math.abs(value) === 1 ? '' : text;
    out += sign + magnitude + power;
  }
  return out || '0';
}

/** Короткая реплика декоративного робота: читает состояние, ни на что не влияет. */
export function robotLine(state: GameState, paused: boolean): string {
  if (state.status === 'riding') return paused ? 'Жду…' : 'Поехали!';
  if (state.status === 'arrived-pending') return 'Доехали! Сохраняю…';
  if (state.status === 'completed') return 'Ура, заряд!';
  if (state.status === 'save-error') return 'Повтори сохранение';
  switch (state.validation.status) {
    case 'ready': return 'Есть путь! Жми «Пуск»';
    case 'pit-contact': return 'Ой, яма! Объедь её';
    case 'no-start': return 'Начни со старта S';
    case 'no-goal': return 'Мимо батареи — подвинь график';
    case 'condition-mismatch': return 'Почти! Проверь точки';
    case 'input-invalid': return 'Допиши число';
    default: return 'Хм… попробуй иначе';
  }
}

export type Tone = 'warn' | 'ok' | 'ride' | 'done';
export function toneOf(state: GameState): Tone {
  if (state.status === 'riding' || state.status === 'arrived-pending') return 'ride';
  if (state.status === 'completed') return 'done';
  return state.status === 'editing-valid' ? 'ok' : 'warn';
}
