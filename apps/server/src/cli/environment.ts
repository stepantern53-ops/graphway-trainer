import { loadApplicationEnvironment } from '../application-environment.js';

export type CommandMode = 'development' | 'test' | 'production';

export function readCommandDatabase(mode: CommandMode, env: NodeJS.ProcessEnv = process.env): string {
  const value = mode === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL;
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    const name = mode === 'production' ? 'graphway_prod' : mode === 'test' ? 'graphway_test' : 'graphway_dev';
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || decodeURIComponent(url.pathname) !== `/${name}`) throw new Error();
  } catch {
    throw new Error('Refusing missing or unexpected command database configuration.');
  }
  return value;
}

export async function loadCommandConfiguration(args: readonly string[]): Promise<{ mode: CommandMode; databaseUrl: string }> {
  const flag = args[0];
  if (args.length > 1 || (flag !== undefined && flag !== '--test' && flag !== '--production')) throw new Error('Invalid command mode arguments.');
  const production = process.env.NODE_ENV === 'production';
  if (production !== (flag === '--production')) throw new Error('Production commands require NODE_ENV=production and --production together.');
  const mode: CommandMode = production ? 'production' : flag === '--test' ? 'test' : 'development';
  await loadApplicationEnvironment();
  return { mode, databaseUrl: readCommandDatabase(mode) };
}
