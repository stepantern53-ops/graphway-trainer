import { createLevel } from './levels.js';
import type { LevelDefinition } from '@graphway/contracts';
type PointSpec = NonNullable<LevelDefinition['exactConditions']>[number];
type CircleSpec = LevelDefinition['geometry']['start'];

const point = (x: PointSpec['x'], y: PointSpec['y']): PointSpec => ({ x, y });
const circle = (x: CircleSpec['x'], y: CircleSpec['y'], r: CircleSpec['r']): CircleSpec => ({ x, y, r });
const line = (id: string, focus: string, active: ('k' | 'b')[], initial: Record<string, string>, start: PointSpec, goal: PointSpec, radius: number, options: { fixed?: Record<string, string>; pit?: CircleSpec; exact?: PointSpec[]; mode?: 'slider-input' | 'input'; title: string; goalText?: string }) => createLevel({
  id, episodeId: 'linear', title: options.title, focus,
  goal: options.goalText ?? 'Соедини стартовую и целевую области безопасной прямой, не касаясь ям.',
  active, mode: options.mode ?? 'slider-input', initial, fixed: options.fixed,
  exactConditions: options.exact,
  geometry: { start: circle(start.x, start.y, radius), goal: circle(goal.x, goal.y, radius), pits: options.pit ? [options.pit] : [], domain: { min: -6, max: 6 } }
});

export const LINEAR_LEVELS: readonly LevelDefinition[] = [
  line('L01', 'Вертикально поднять дорогу, исследовать b', ['b'], { b: '0' }, point(-3, -1), point(3, 5), 0.8, { fixed: { k: '1' }, title: 'Подними дорогу', goalText: 'Измени b и соедини стартовую и целевую области.' }),
  line('L02', 'b отрицателен, отметить пересечение Oy', ['b'], { b: '1' }, point(-3, -5), point(3, 1), 0.7, { fixed: { k: '1' }, title: 'Пересечение Oy ниже нуля', goalText: 'Измени b и соедини две области; найди, где график пересекает Oy.' }),
  line('L03', 'Положительный наклон при b=0', ['k'], { k: '0' }, point(-2, -2), point(3, 3), 0.65, { fixed: { b: '0' }, title: 'Подъём вправо', goalText: 'Измени k и проведи линию через начало координат между областями.' }),
  line('L04', 'Отрицательный наклон при движении вправо', ['k'], { k: '1' }, point(-3, 3), point(3, -3), 0.65, { fixed: { b: '0' }, title: 'Спуск вправо', goalText: 'Измени k и соедини области прямой, убывающей при движении вправо.' }),
  line('L05', 'Фокус: величина наклона и отношение приращений; Δy=2 при Δx=4 — пример, не обязательное условие ответа', ['k'], { k: '2' }, point(-2, -1), point(4, 2), 0.5, { fixed: { b: '0' }, title: 'Наклон и подъём', goalText: 'Исследуй, как k связан с подъёмом графика при движении вправо. Соедини стартовую и целевую области.' }),
  line('L06', 'Фокус: горизонтальная прямая на примере k=0; точное k=0 не требуется, цель — соединить области', ['k'], { k: '-1' }, point(-3, 2), point(3, 2), 0.5, { fixed: { b: '2' }, title: 'Горизонтальная прямая', goalText: 'Посмотри в теории, как выглядит прямая при k=0. Изменяя k, соедини стартовую и целевую области.' }),
  line('L07', 'Отрицательные x и дробный отрицательный k', ['k'], { k: '1' }, point(-4, 3), point(-1, '3/2'), 0.4, { fixed: { b: '1' }, title: 'Дробный наклон' }),
  line('L08', 'Совместное управление k и b', ['k', 'b'], { k: '0', b: '0' }, point(-3, -1), point(3, 2), 0.4, { title: 'Два коэффициента' }),
  line('L09', 'Совместное управление, первое знакомство с ямой', ['k', 'b'], { k: '0', b: '0' }, point(-3, 4), point(3, 1), 0.35, { pit: circle(0, 0, 0.45), title: 'Объедь яму' }),
  line('L10', 'Точный k=Δy/Δx, точки (-2,-2),(4,1)', ['k'], { k: '0' }, point(-2, -2), point(4, 1), 0.12, { fixed: { b: '-1' }, exact: [point(-2, -2), point(4, 1)], mode: 'input', title: 'Точный наклон', goalText: 'Введи k вручную так, чтобы график прошёл через обе заданные точки и соединил области.' }),
  line('L11', 'Восстановить k,b, точки (-2,4),(2,-2)', ['k', 'b'], { k: '0', b: '0' }, point(-2, 4), point(2, -2), 0.12, { exact: [point(-2, 4), point(2, -2)], mode: 'input', title: 'Восстанови прямую', goalText: 'Введи k и b вручную; обе точки — обязательные условия, маршрут должен быть безопасным.' }),
  line('L12', 'Перенос: два отрицательных x, дробный b; точки (-4,-3/2),(-1,3/4)', ['k', 'b'], { k: '1', b: '0' }, point(-4, '-3/2'), point(-1, '3/4'), 0.12, { exact: [point(-4, '-3/2'), point(-1, '3/4')], mode: 'input', title: 'Дробные координаты', goalText: 'Введи k и b вручную; график должен пройти через обе дробные точки и соединить области.' })
];
