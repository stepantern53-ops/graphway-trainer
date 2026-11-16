import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { Client } from 'pg';
import { loadRuntimeEnvironment } from './local-runtime.mjs';

const env = await loadRuntimeEnvironment();
const projectRoot = process.cwd();
const targets = [
  { name: 'graphway_dev', connectionString: env.DATABASE_URL },
  { name: 'graphway_test', connectionString: env.TEST_DATABASE_URL }
];

async function checkDatabase({ name, connectionString }) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT current_database() AS database_name, current_user AS role_name,
        d.datdba = r.oid AS owns_database,
        r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
        (SELECT count(*) FROM pg_database owned WHERE owned.datdba = r.oid) AS owned_database_count
      FROM pg_database d CROSS JOIN pg_roles r
      WHERE d.datname = current_database() AND r.rolname = current_user
    `);
    const row = result.rows[0];
    if (!row || row.database_name !== name || !row.owns_database || row.owned_database_count !== '2' ||
      row.rolsuper || row.rolcreatedb || row.rolcreaterole || row.rolreplication || row.rolbypassrls) {
      throw new Error(`Database role or ownership check failed for ${name}.`);
    }
    await client.query('SELECT 1');
  } finally {
    await client.end().catch(() => {});
  }
}

async function existingChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (!process.env.LOCALAPPDATA) return undefined;
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
  let entries;
  try {
    entries = await readdir(cache, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const versions = entries
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => Number(right.name.slice(9)) - Number(left.name.slice(9)));
  for (const entry of versions) {
    const executable = join(cache, entry.name, 'chrome-win64', 'chrome.exe');
    try {
      if ((await stat(executable)).isFile()) return executable;
    } catch {
      // Ignore incomplete cached browser revisions.
    }
  }
}

async function browserScenario() {
  const baseURL = `http://127.0.0.1:${env.PORT}`;
  const executablePath = await existingChromium();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(15_000);
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByText('Восстановления пароля нет.', { exact: false }).waitFor();
    const nickname = `smoke_${randomBytes(6).toString('hex')}`;
    const password = randomBytes(24).toString('base64url');
    await page.locator('#nickname').fill(nickname);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Создать аккаунт и открыть L01 →' }).click();
    const coefficient = page.locator('#coefficient-b');
    await coefficient.waitFor({ state: 'visible' });
    if (!page.url().endsWith('#/levels/L01')) throw new Error('Registration did not open L01.');
    await coefficient.fill('2');
    const launch = page.getByRole('button', { name: '▶ Пуск', exact: true });
    await launch.waitFor({ state: 'visible' });
    if (await launch.isDisabled()) throw new Error('L01 did not become locally ready with a valid route.');
    await launch.click();
    await page.getByTestId('route-status').getByText('Прохождение подтверждено сервером. Трасса сохранена.').waitFor({ timeout: 15_000 });
    const response = await page.request.get(`${baseURL}/api/me`, { timeout: 15_000 });
    if (!response.ok()) throw new Error('Authenticated progress could not be read after arrival.');
    const progress = (await response.json()).progress;
    if (!progress.completedLevelIds.includes('L01') || !progress.unlockedLevelIds.includes('L02')) {
      throw new Error('Server progress did not save L01 and unlock L02.');
    }
    await page.reload({ waitUntil: 'networkidle' });
    await coefficient.waitFor({ state: 'visible' });
    if (await coefficient.inputValue() !== '0') throw new Error('L01 did not reload with its initial coefficients.');
    if (!await launch.isDisabled()) throw new Error('L01 initial coefficients unexpectedly became ready after reload.');
    await page.goto(`${baseURL}/#/levels/L02`, { waitUntil: 'networkidle' });
    await page.getByText('ТРАССА L02', { exact: true }).waitFor();
    if (await coefficient.inputValue() !== '1') throw new Error('Unlocked L02 did not load its initial coefficients.');
  } finally {
    await browser.close();
  }
}

let stage = 'database_access';
const checks = [];
try {
  for (const target of targets) {
    await checkDatabase(target);
    checks.push(target.name);
  }
  stage = 'backend_readiness';
  const api = await fetch(`http://127.0.0.1:${env.PORT}/api/health/ready`, { signal: AbortSignal.timeout(5000) });
  if (!api.ok) throw new Error(`Backend readiness returned HTTP ${api.status}.`);
  stage = 'web_readiness';
  const web = await fetch(`http://127.0.0.1:${env.PORT}/`, { signal: AbortSignal.timeout(5000) });
  if (!web.ok) throw new Error(`Web server returned HTTP ${web.status}.`);
  stage = 'browser_registration_game';
  await browserScenario();
  stage = 'summary_write';
  await mkdir(join(projectRoot, '.local'), { recursive: true });
  await writeFile(join(projectRoot, '.local', 'smoke-report.json'), JSON.stringify({
    result: 'passed',
    databaseChecks: checks,
    browser: 'synthetic student registration, L01 arrival/save, reload initial state, L02 unlock',
    viewport: '1440x900',
    url: `http://127.0.0.1:${env.PORT}`
  }, null, 2) + '\n', { mode: 0o600 });
  console.log('GraphWay smoke passed: least-privilege PostgreSQL checks, backend/web readiness, browser registration, saved L01, reload initial state, and unlocked L02.');
} catch {
  const code = `GW_SMOKE_${stage.toUpperCase()}`;
  await mkdir(join(projectRoot, '.local'), { recursive: true }).catch(() => {});
  await writeFile(join(projectRoot, '.local', 'smoke-report.json'), JSON.stringify({
    result: 'failed',
    code,
    stage,
    databaseChecks: checks
  }, null, 2) + '\n', { mode: 0o600 }).catch(() => {});
  console.error(`GraphWay smoke failed [${code}] at ${stage}. Check local PostgreSQL and application readiness without exposing runtime settings.`);
  process.exitCode = 1;
}
