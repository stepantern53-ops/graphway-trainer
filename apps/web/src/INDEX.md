# Web source

- `app/`: authenticated hash navigation, API, theme tokens.
- `auth/`, `home/`, `episodes/`: registration/login, true progress, two-episode catalog.
- `game/`: RAM-only reducer, live controls, equal-scale SVG, optional structured theory, arrival confirmation.
- `layout/`: stable orientation gate without unmounting state.
- `robot/`: separately owned procedural Step42 scene.
- `*.test.ts(x)`, `test-fixture.ts`: consumer-focused state/controls/orientation/lifecycle tests. No coefficient drafts or passwords are written to browser storage.

`vite-env.d.ts` declares Vite/CSS Module asset imports. Local font/KaTeX redistribution notices live in `../public/` and are copied unchanged by Vite.
