# Математическое ядро

- `src/` - общий чистый TypeScript-контракт, рациональный ввод, точные условия и геометрия.
- `tests/` - consumer-visible regression fixtures parser/roots/contacts/routes.
- `package.json` - source ESM export `@graphway/math-core`; используется браузером и сервером.

## Контракт и точность

`src/index.ts` экспортирует `parseCoefficient`, rational arithmetic/transport, `evaluateFunction`/`evaluateRational`/`functionPolynomial`, `circleContacts`, `isolatePolynomialRoots`, `validateExactConditions`, `validateRoute` и типы из `types.ts`. Только pure TS; bigint остаётся внутри математики, для JSON предусмотрен строковый `rationalToTransport`. Каталог передаёт Scalar строками/числами.

`validateRoute` подставляет пропущенные fixed, отвергает неизвестные поля, изменение fixed и нарушение bounds, затем проверяет рационально все exact conditions. Геометрия перебирает все упорядоченные пары компонентов, выбирает earliest goal/latest eligible start. Свидетельства решения не входят в runtime.

Полином круга строится точно из исходных рациональных значений. Замена координат переводит domain в [-1,1]. Точное евклидово выделение square-free части сохраняет кратные корни как отдельные корни для derivative partition; никаких внешних CAS. Double Horner использует `64*EPSILON*max(1,scale)`, bisection width 1e-10. При неоднозначности изоляция повторяется из исходных rational coefficients через независимый Decimal80, relative residual 1e-60 и width 1e-24; double brackets также полируются до 1e-24 для согласованности контактов. Направленное округление вниз/вверх сохраняет enclosure при неограниченной десятичной дроби и обратной замене координат.

Знак каждой открытой ячейки между корнями определяется точной рациональной подстановкой midpoint. Нулевые singleton-компоненты не объединяются через положительную ячейку. Дедупликация корней только по пересекающимся brackets. Для сравнения независимо изолированных общих endpoints перекрытие brackets подтверждается точным polynomial GCD и корнем общего множителя; экранного epsilon нет. Неразличимые number-координаты или недоказуемое сравнение дают `numeric-uncertain`, не разрешение запуска.

Проверка только пакета: `npm run test:unit -- --project math-core` (или `node node_modules/vitest/vitest.mjs run --project math-core`). Общие typecheck/build выполняет координатор.
