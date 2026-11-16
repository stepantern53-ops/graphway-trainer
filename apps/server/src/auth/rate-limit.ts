import { createHash } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../errors.js';

export class AuthRateLimit {
  constructor(private readonly pool: pg.Pool) {}
  private key(kind: string, identity: string) { return `${kind}:${createHash('sha256').update(identity).digest('hex')}`; }
  async consume(kind: string, identity: string, limit: number, seconds: number): Promise<void> {
    const result = await this.pool.query(`INSERT INTO auth_limits (key,count,expires_at) VALUES ($1,1,now()+$2 * interval '1 second')
      ON CONFLICT (key) DO UPDATE SET count=CASE WHEN auth_limits.expires_at<=now() THEN 1 ELSE auth_limits.count+1 END,
      expires_at=CASE WHEN auth_limits.expires_at<=now() THEN now()+$2 * interval '1 second' ELSE auth_limits.expires_at END
      RETURNING count,GREATEST(1,ceil(extract(epoch from expires_at-now()))) AS retry`, [this.key(kind, identity), seconds]);
    const row = result.rows[0];
    if (row.count > limit) throw new ApiError(429, 'AUTH_RATE_LIMIT', 'Слишком много попыток. Попробуй позже.', undefined, Number(row.retry));
  }
  async releaseSuccessfulIp(identity: string): Promise<void> {
    // Remove this request's reservation; earlier failed attempts stay in the IP envelope.
    await this.pool.query('UPDATE auth_limits SET count=GREATEST(0,count-1) WHERE key=$1', [this.key('login-ip', identity)]);
  }
  async clearNickname(identity: string): Promise<void> { await this.pool.query('DELETE FROM auth_limits WHERE key=$1', [this.key('login-nickname', identity)]); }
  async prune(): Promise<void> { await this.pool.query('DELETE FROM auth_limits WHERE expires_at<now()'); }
}
