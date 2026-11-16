export interface ServerConfig {
  databaseUrl: string;
  sessionSecret: string;
  port: number;
  production: boolean;
  allowedOrigins: readonly string[];
  trustedProxy?: string;
  staticDirectory?: string;
}
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const test = env.NODE_ENV === 'test';
  const port = Number(test ? env.TEST_PORT ?? '3002' : env.PORT ?? '3001');
  const webPort = Number(env.WEB_PORT ?? '5173');
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(webPort) || webPort < 1 || webPort > 65535) throw new Error('Invalid local ports');
  const databaseUrl = test ? env.TEST_DATABASE_URL : env.DATABASE_URL;
  if (!databaseUrl || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Missing database or secure session configuration');
  if (test && decodeURIComponent(new URL(databaseUrl).pathname) !== '/graphway_test') throw new Error('Refusing non-test database in test mode');
  const production = env.NODE_ENV === 'production';
  const origins = production ? env.APP_ORIGIN?.split(',') : test ? [`http://127.0.0.1:${port}`] : [`http://127.0.0.1:${port}`, `http://127.0.0.1:${webPort}`, `http://localhost:${port}`, `http://localhost:${webPort}`];
  if (!origins?.length || origins.some(origin => { try { return new URL(origin).origin !== origin || (production && !origin.startsWith('https://')); } catch { return true; } })) throw new Error('Invalid application origin configuration');
  return { databaseUrl, sessionSecret: env.SESSION_SECRET, port, production, allowedOrigins: origins, ...(env.TRUSTED_PROXY ? { trustedProxy: env.TRUSTED_PROXY } : {}) };
}
