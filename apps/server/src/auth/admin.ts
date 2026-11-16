import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { CURRENT_CURRICULUM_VERSION } from '@graphway/curriculum';
import { transaction } from '../db/client.js';
import { AuthService, nicknameKey } from './service.js';

export interface AdminCredentials { nickname: string; password: string }
export async function provisionAdmin(pool: pg.Pool, saveCredentials: (credentials: AdminCredentials) => Promise<void>) {
  return transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(417284,2)');
    const existing = await client.query("SELECT id FROM users WHERE role='admin'");
    if (existing.rowCount) return { created: false };
    const credentials = { nickname: `admin_${randomBytes(8).toString('hex')}`, password: randomBytes(32).toString('base64url') };
    const encoded = await new AuthService(pool).hash(credentials.password);
    const created = await client.query("INSERT INTO users (nickname_display,nickname_key,password_hash,role) VALUES ($1,$2,$3,'admin') RETURNING id", [credentials.nickname, nicknameKey(credentials.nickname), encoded]);
    await client.query("INSERT INTO progress (user_id,curriculum_version,current_level_id) VALUES ($1,$2,'L01')", [created.rows[0].id, CURRENT_CURRICULUM_VERSION]);
    await saveCredentials(credentials);
    return { created: true };
  });
}
