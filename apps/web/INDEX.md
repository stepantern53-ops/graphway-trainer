# Web

React 19 / Vite 7 client. `src/main.tsx` mounts `app/App.tsx`; `vite.config.ts` binds loopback and proxies `/api` without changing Origin. `npm run dev --workspace @graphway/web`; production output: `apps/web/dist`, served by backend. API uses strict shared contracts and same-origin sessions; no mock API or credential storage. New login/reload loads lesson initial fields. Unit-тесты: `npx vitest run --project web` из корня. Браузерные и интеграционные проверки выполняются отдельными наборами из корня репозитория.
