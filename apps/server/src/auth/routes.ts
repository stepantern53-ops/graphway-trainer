import { Router, type Request, type RequestHandler, type Response } from 'express';
import { Passport } from 'passport';
import { Strategy } from 'passport-local';
import type pg from 'pg';
import { credentialsSchema, type SafeUser } from '@graphway/contracts';
import { CURRENT_CURRICULUM_VERSION } from '@graphway/curriculum';
import { AuthService, nicknameKey } from './service.js';
import { AuthRateLimit } from './rate-limit.js';
import { csrfToken } from './csrf.js';
import { requireAuthentication, sessionCookieName } from './session.js';
import { ApiError } from '../errors.js';
import { transaction } from '../db/client.js';
import { getProgress } from '../game/progress.js';

export function createAuthentication(pool: pg.Pool, csrf: RequestHandler) {
  const service = new AuthService(pool);
  const limiter = new AuthRateLimit(pool);
  const passport = new Passport();
  passport.use(new Strategy({ usernameField: 'nickname', passwordField: 'password' }, (nickname, password, done) => {
    service.authenticate(nickname, password).then(user => done(null, user ?? false), done);
  }));
  passport.serializeUser((user, done) => { done(null, (user as SafeUser).id); });
  passport.deserializeUser<string>((id, done) => { service.user(id).then(user => done(null, user ?? false), done); });
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/csrf', async (req, res) => {
    const token = csrfToken(req);
    try {
      await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    } catch (error) {
      delete req.session.csrfToken;
      throw error;
    }
    res.json({ csrfToken: token });
  });
  async function establishSession(req: Request, res: Response, user: SafeUser, status: number) {
    // Passport login regenerates the session. No pre-auth metadata survives.
    await new Promise<void>((resolve, reject) => req.logIn(user, error => error ? reject(error) : resolve()));
    csrfToken(req);
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.status(status).json({ user, progress: await getProgress(pool, user) });
  }
  router.post('/register', csrf, async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Проверь никнейм и пароль.');
    await limiter.consume('signup-ip', req.ip ?? '', 5, 3600);
    const { nickname, password } = parsed.data;
    const passwordHash = await service.hash(password);
    let user: SafeUser;
    try {
      user = await transaction(pool, async client => {
        const result = await client.query("INSERT INTO users (nickname_display,nickname_key,password_hash,role) VALUES ($1,$2,$3,'student') RETURNING id,nickname_display,role", [nickname, nicknameKey(nickname), passwordHash]);
        const row = result.rows[0];
        await client.query("INSERT INTO progress (user_id,curriculum_version,current_level_id) VALUES ($1,$2,'L01')", [row.id, CURRENT_CURRICULUM_VERSION]);
        return { id: row.id, nickname: row.nickname_display, role: row.role };
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '23505') throw new ApiError(409, 'NICKNAME_TAKEN', 'Этот никнейм уже занят.', 'nickname');
      throw error;
    }
    await establishSession(req, res, user, 201);
  });
  router.post('/login', csrf, async (req, res, next) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Проверь никнейм и пароль.');
    req.body = parsed.data;
    const identity = `${req.ip ?? ''}\0${nicknameKey(parsed.data.nickname)}`;
    await limiter.consume('login-ip', req.ip ?? '', 50, 900);
    await limiter.consume('login-nickname', identity, 10, 900);
    passport.authenticate('local', (error: unknown, user: SafeUser | false) => {
      if (error) return next(error);
      if (!user) return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный никнейм или пароль'));
      Promise.all([limiter.clearNickname(identity), limiter.releaseSuccessfulIp(req.ip ?? '')]).then(() => establishSession(req, res, user, 200)).catch(next);
    })(req, res, next);
  });
  router.post('/logout', requireAuthentication, csrf, async (req, res) => {
    if (req.body !== undefined && (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body) || Object.keys(req.body).length)) throw new ApiError(400, 'INVALID_INPUT', 'Выход не принимает поля запроса.');
    await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(sessionCookieName, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
    res.sendStatus(204);
  });
  return { passport, router, limiter };
}
