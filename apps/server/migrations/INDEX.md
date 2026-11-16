# Versioned migrations

Drizzle Kit generated SQL is applied explicitly by the migrate command, never by application startup. `meta/` contains the matching snapshot and journal. Initial migration defines users, sessions, completions, progress and expiring auth limits. Singleton admin uses a partial unique index on a constant. Generate future changes from root with `npx drizzle-kit generate --config apps/server/drizzle.config.ts`.
