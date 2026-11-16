import { createLevel } from './levels.js';
import type { LevelDefinition } from '@graphway/contracts';
type PointSpec = NonNullable<LevelDefinition['exactConditions']>[number];
type CircleSpec = LevelDefinition['geometry']['start'];
const point = (x: PointSpec['x'], y: PointSpec['y']): PointSpec => ({ x, y });
const circle = (x: CircleSpec['x'], y: CircleSpec['y'], r: CircleSpec['r']): CircleSpec => ({ x, y, r });
const quadratic = (id: string, focus: string, active: ('a' | 'b' | 'c')[], initial: Record<string, string>, start: PointSpec, goal: PointSpec, radius: number, options: { fixed?: Record<string, string>; pits?: CircleSpec[]; exact?: PointSpec[]; mode?: 'slider-input' | 'input'; title: string; goalText?: string }) => createLevel({
  id, episodeId: 'quadratic', title: options.title, focus,
  goal: options.goalText ?? 'Измени разрешённые коэффициенты и соедини стартовую и целевую области, не касаясь ям.',
  active, mode: options.mode ?? 'slider-input', initial, fixed: options.fixed,
  exactConditions: options.exact,
  geometry: { start: circle(start.x, start.y, radius), goal: circle(goal.x, goal.y, radius), pits: options.pits ?? [], domain: { min: -6, max: 6 } }
});

export const QUADRATIC_LEVELS: readonly LevelDefinition[] = [
  quadratic('Q01', 'c поднимает график, c=f(0)', ['c'], { c: '-3' }, point(-2, 5), point(2, 5), 0.65, { fixed: { a: '1', b: '0' }, title: 'Пересечение Oy' }),
  quadratic('Q02', 'Знак a: построить ветви вниз', ['a'], { a: '1' }, point(-2, -1), point(2, -1), 0.6, { fixed: { b: '0', c: '3' }, title: 'Направление ветвей' }),
  quadratic('Q03', 'Ширина относительно вершины, a положителен', ['a'], { a: '2' }, point(-3, '9/4'), point(3, '9/4'), 0.5, { fixed: { b: '0', c: '0' }, pits: [circle(0, 3, 0.45)], title: 'Ширина параболы' }),
  quadratic('Q04', 'b меняет ось и высоту вершины, a,c fixed', ['b'], { b: '0' }, point(-1, 3), point(3, 3), 0.5, { fixed: { a: '1', c: '0' }, pits: [circle(1, 1, 0.4)], title: 'Ось и вершина' }),
  quadratic('Q05', 'Обратный знак b, отрицательная абсцисса вершины', ['b'], { b: '-1' }, point(-3, 3), point(1, 3), 0.45, { fixed: { a: '1', c: '0' }, pits: [circle(-1, 1, 0.4)], title: 'Положение оси' }),
  quadratic('Q06', 'a и c совместно, ветви вниз, объехать яму сверху', ['a', 'c'], { a: '1', c: '0' }, point(-2, 1), point(2, 1), 0.4, { fixed: { b: '0' }, pits: [circle(0, 0, 0.6)], title: 'Ветви вниз и безопасный путь' }),
  quadratic('Q07', 'b,c совместно при фиксированном a', ['b', 'c'], { b: '0', c: '0' }, point(-1, 2), point(3, 2), 0.35, { fixed: { a: '1' }, pits: [circle(1, 1, 0.45)], title: 'Сдвиг формы' }),
  quadratic('Q08', 'Все коэффициенты и безопасный участок; яма после цели не мешает', ['a', 'b', 'c'], { a: '1', b: '0', c: '0' }, point(-2, 4), point(3, '3/2'), 0.3, { pits: [circle(1, 2, 0.4), circle(5, '15/2', 0.3)], title: 'Все коэффициенты' }),
  quadratic('Q09', 'Точное восстановление b,c при a=1; точки (-1,0),(2,3)', ['b', 'c'], { b: '0', c: '0' }, point(-1, 0), point(2, 3), 0.12, { fixed: { a: '1' }, exact: [point(-1, 0), point(2, 3)], mode: 'input', title: 'Две точки и фиксированное a', goalText: 'Введи b и c вручную. При a=1 обе точки — обязательные условия, а маршрут должен быть безопасным.' }),
  quadratic('Q10', 'Общая парабола по трём точкам (-1,4),(0,1),(2,1)', ['a', 'b', 'c'], { a: '1', b: '0', c: '0' }, point(-1, 4), point(2, 1), 0.12, { exact: [point(-1, 4), point(0, 1), point(2, 1)], pits: [circle(1, 2, 0.35)], mode: 'input', title: 'Три условия' }),
  quadratic('Q11', 'Дробные коэффициенты, точки (-2,4),(0,1),(3,4)', ['a', 'b', 'c'], { a: '1', b: '0', c: '0' }, point(-2, 4), point(3, 4), 0.12, { exact: [point(-2, 4), point(0, 1), point(3, 4)], pits: [circle(1, '-2', 0.4)], mode: 'input', title: 'Дробное восстановление' }),
  quadratic('Q12', 'Перенос: ветви вниз, три точки (-2,-3),(0,3),(3,3/4)', ['a', 'b', 'c'], { a: '1', b: '0', c: '0' }, point(-2, -3), point(3, '3/4'), 0.12, { exact: [point(-2, -3), point(0, 3), point(3, '3/4')], pits: [circle(0, 0, 0.5)], mode: 'input', title: 'Парабола вниз', goalText: 'Введи a, b и c вручную; все три точки — обязательные условия и график должен безопасно соединить области.' })
];
