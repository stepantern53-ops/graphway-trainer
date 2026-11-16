import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type pg from 'pg';
import type { SafeUser } from '@graphway/contracts';
import { ApiError } from '../errors.js';

const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
export function nicknameKey(nickname: string): string { return nickname.trim().normalize('NFC').toLowerCase(); }
export class AuthService {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private dummyHash?: Promise<string>;
  constructor(private readonly pool: pg.Pool) {}
  private async bounded<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= 2) {
      if (this.queue.length >= 8) throw new ApiError(429, 'AUTH_BUSY', 'Слишком много запросов. Попробуй чуть позже.', undefined, 2);
      await new Promise<void>(resolve => this.queue.push(resolve));
    } else { this.active++; }
    try { return await work(); }
    finally {
      const next = this.queue.shift();
      if (next) next(); else this.active--;
    }
  }
  async hash(password: string): Promise<string> { return this.bounded(() => argon2.hash(password, options)); }
  async authenticate(nickname: string, password: string): Promise<SafeUser | null> {
    const result = await this.pool.query('SELECT id,nickname_display,role,password_hash FROM users WHERE nickname_key=$1', [nicknameKey(nickname)]);
    const row = result.rows[0];
    let encoded: string = row?.password_hash;
    if (!encoded) {
      this.dummyHash ??= this.hash(randomBytes(32).toString('base64url')).catch(error => {
        this.dummyHash = undefined;
        throw error;
      });
      encoded = await this.dummyHash;
    }
    const valid = await this.bounded(() => argon2.verify(encoded, password));
    return row && valid ? { id: row.id, nickname: row.nickname_display, role: row.role } : null;
  }
  async user(id: string): Promise<SafeUser | null> {
    const result = await this.pool.query('SELECT id,nickname_display,role FROM users WHERE id=$1', [id]);
    const row = result.rows[0];
    return row ? { id: row.id, nickname: row.nickname_display, role: row.role } : null;
  }
}
