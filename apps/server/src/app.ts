import express from 'express';
import helmet from 'helmet';
import type pg from 'pg';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import type { ServerConfig } from './config.js';
import { createSession } from './auth/session.js';
import { createAuthentication } from './auth/routes.js';
import { csrfProtection } from './auth/csrf.js';
import { gameRoutes } from './game/routes.js';
import { ApiError, errorHandler } from './errors.js';
import { getMigrationsDirectory } from './db/migrate.js';

export interface AppDependencies { pool: pg.Pool; config: ServerConfig }
export function createApp({ pool, config }: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustedProxy) app.set('trust proxy', config.trustedProxy);
  const { middleware, store } = createSession(pool, config);
  app.locals.sessionStore = store;
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'], fontSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } }, strictTransportSecurity: config.production ? undefined : false }));
  app.get('/api/health/live', (_req, res) => { res.json({ status: 'ok' }); });
  app.get('/api/health/ready', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const expected = readMigrationFiles({ migrationsFolder: getMigrationsDirectory() });
      const history = await pool.query('SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at');
      if (expected.some(migration => !history.rows.some(row => row.hash === migration.hash))) throw new Error('Migrations required');
      const result = await pool.query("SELECT (SELECT count(*) FROM users WHERE role='admin')=1 AS admin, to_regclass('sessions') IS NOT NULL AND to_regclass('completions') IS NOT NULL AND to_regclass('progress') IS NOT NULL AND to_regclass('auth_limits') IS NOT NULL AS schema");
      if (!result.rows[0].admin || !result.rows[0].schema) throw new Error('Configuration incomplete');
      res.json({ status: 'ok' });
    } catch { res.status(503).json({ error: { code: 'NOT_READY', message: 'Сервер ещё не настроен или база данных недоступна.' } }); }
  });
  app.use('/api', express.json({ limit: '8kb', strict: true }));
  app.use('/api', middleware);
  const csrf = csrfProtection(config.allowedOrigins);
  const authentication = createAuthentication(pool, csrf);
  app.use('/api', authentication.passport.initialize(), authentication.passport.session());
  app.use('/api/auth', authentication.router);
  app.use('/api', gameRoutes(pool, csrf));
  app.use('/api', (_req, _res, next) => { next(new ApiError(404, 'NOT_FOUND', 'API маршрут не найден.')); });
  if (config.staticDirectory) {
    app.use(express.static(config.staticDirectory, { index: false }));
    app.get('/{*path}', (req, res, next) => { if (!req.accepts('html')) return next(); res.sendFile('index.html', { root: config.staticDirectory! }); });
  }
  app.use((_req, _res, next) => { next(new ApiError(404, 'NOT_FOUND', 'Страница не найдена.')); });
  app.use(errorHandler);
  app.locals.prune = async () => { await authentication.limiter.prune(); await pool.query('DELETE FROM sessions WHERE expire<now()'); };
  return app;
}
