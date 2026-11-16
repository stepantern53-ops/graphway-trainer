import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export interface Database { pool: pg.Pool; db: NodePgDatabase<typeof schema> }
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 3_000, idleTimeoutMillis: 30_000 });
  pool.on('error', () => { console.error('PostgreSQL pool connection unavailable.'); });
  return { pool, db: drizzle(pool, { schema }) };
}
export type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;
export async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
