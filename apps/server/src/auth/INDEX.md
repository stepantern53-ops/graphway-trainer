# Authentication

`service.ts` uses Argon2id with 19,456 KiB / two passes / one lane and bounded work admission; `routes.ts` connects Passport Local and strict shared schemas. `session.ts` uses PostgreSQL-only sessions. `csrf.ts` enforces session synchronizer token and configured Origin. `rate-limit.ts` persists bounded-window auth counters in PostgreSQL. `admin.ts` provisions a singleton under transactional advisory lock; credential persistence is an explicit secure CLI boundary.

Protected mutations (complete/current/logout) require a real authenticated user before CSRF validation, so expired sessions return 401 and can reauthenticate. Register/login remain pre-auth CSRF protected. An authenticated request still requires both the fresh synchronizer token and allowed Origin; locked lessons remain 403.
