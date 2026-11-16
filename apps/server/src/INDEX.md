# Server source

`app.ts` constructs Express without listening; `main.ts` binds loopback and maintains expired PG rows. `config.ts` validates runtime origins/cookies/proxy configuration. `errors.ts` exposes safe JSON errors. `db/` owns schema and explicit migrations, `auth/` owns accounts/sessions/CSRF/throttle/admin, `game/` owns access/progress/completion, `cli/` contains operator commands.

`application-environment.ts` selects externally supplied production env versus the existing Windows import. `runtime.d.ts` remains the ambient declaration for the local helper (do not create a colliding `runtime.ts`). `cli/environment.ts` owns explicit command modes/exact database isolation; `cli/admin-artifact.ts` owns canonical external private path validation and exclusive creation with permissions restricted before credential writes.

Malformed JSON, oversized requests and unsupported JSON charset/content encoding return safe `400 INVALID_INPUT`, without reflecting parser details or classifying client format errors as server failures.
