# Game API

`access.ts` derives unlock from catalog order and confirmed completions. `progress.ts` reads current/next/unlocked/completed metadata. `completion.ts` validates full shared math on every attempt before an idempotent transactional completion insert, with user-row serialization against current changes. `routes.ts` exposes the approved authenticated endpoints. No server ride lifecycle, timing receipt, witness comparison or coefficient persistence exists.
