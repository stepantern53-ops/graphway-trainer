import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type pg from 'pg';
import type { ServerConfig } from '../config.js';
import type { Request, RequestHandler } from 'express';
import type { SafeUser } from '@graphway/contracts';
import { ApiError } from '../errors.js';

export const sessionCookieName = 'graphway.sid';
export function requireUser(req: Request): SafeUser {
  if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Войди в аккаунт.');
  return req.user as SafeUser;
}
export function createSession(pool: pg.Pool, config: ServerConfig) {
  const PgStore = connectPgSimple(session);
  const store = new PgStore({ pool, tableName: 'sessions', createTableIfMissing: false, pruneSessionInterval: false, errorLog: () => console.error('Session store unavailable.') });
  return { store, middleware: session({
    name: sessionCookieName, secret: config.sessionSecret, store, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 },
  }) };
}

export const requireAuthentication: RequestHandler = (req, _res, next) => {
  requireUser(req);
  next();
};
