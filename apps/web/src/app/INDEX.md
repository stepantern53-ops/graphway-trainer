# Application

`App.tsx` owns session, progress, hash routes and the current in-memory game. Routes contain only episode/level IDs, never coefficients. `api.ts` uses shared Zod schemas, cookie sessions, CSRF and honest HTTP errors. `tokens.css` / `App.module.css` define Manrope, purple sci-fi tokens, focus and shell.

Explicit logout treats HTTP 401 as an already-ended server session and clears local identity/progress/game RAM before showing authentication. Other logout failures remain honest errors without clearing RAM. `../app-session.test.tsx` checks both branches, including same-user login after explicit expired logout.

Route loading belongs to the current route effect. Leaving a game route clears its loading presentation immediately; cancelled older level/current responses retain cancellation guards and cannot overwrite a newer route's progress or loading state. `../app-session.test.tsx` covers both pending request stages through Home → Episodes → a newer game request, including late responses.

`Icon.tsx` is the shared decorative line-icon set (always `aria-hidden`; the button text or `aria-label` carries meaning). Palette: purple brand + cream white + dark ink; legacy variable names (`--primary`, `--panel`, `--border` …) are kept and mapped onto it. The header shows confirmed progress and a profile popover (nickname, progress, home, logout).

Оболочка владеет управлением сессией, прогрессом, маршрутами и текущей игрой в памяти; визуальные правки не меняют поведение API, сессии, маршрутов, CSRF и повторного сохранения. Возврат фокуса в профиле по Escape и Tab принадлежит оболочке. Загрузка метаданных главной показывает ошибки и 401 и отменяет запросы ушедшего потребителя; главная привязана к идентичности пользователя. Хранение введённых коэффициентов отсутствует.
