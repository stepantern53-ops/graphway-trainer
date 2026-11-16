# Database

- `schema.ts`: Drizzle PostgreSQL tables and singleton-admin partial UNIQUE index.
- `client.ts`: bounded pg pool, typed Drizzle handle, transactional SQL helper.
- `migrate.ts`: explicit versioned Drizzle migration runner protected by advisory lock.

Runtime never creates schema. No coefficient drafts or ride state are stored.
