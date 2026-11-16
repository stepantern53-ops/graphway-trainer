import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { SafeUser } from '@graphway/contracts';
import type { Request, RequestHandler } from 'express';
import { ApiError } from '../errors.js';

declare module 'express-session' { interface SessionData { csrfToken?: string } }
export function csrfToken(req: Request): string {
  req.session.csrfToken ??= randomBytes(32).toString('base64url');
  return req.session.csrfToken;
}
export function csrfProtection(allowedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const token = req.get('X-CSRF-Token');
    const expected = req.session.csrfToken;
    const origin = req.get('Origin');
    if (!origin || !allowedOrigins.includes(origin) || !token || !expected || Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return next(new ApiError(403, 'CSRF_INVALID', 'Обнови страницу и повтори действие.'));
    }
    const owner = req.get('X-GraphWay-User');
    if (owner && owner !== (req.user as SafeUser | undefined)?.id) {
      return next(new ApiError(409, 'SESSION_CHANGED', 'Аккаунт изменился в другой вкладке. Войди снова.'));
    }
    next();
  };
}
