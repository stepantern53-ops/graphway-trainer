import { afterEach, expect, test } from 'vitest';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdminArtifact, resolveProductionAdminArtifact } from '../src/cli/admin-artifact.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'graphway-artifact-'));
  temporaryDirectories.push(root);
  const release = join(root, 'release');
  const privateDirectory = join(root, 'private');
  await mkdir(release);
  await mkdir(privateDirectory, { mode: 0o700 });
  return { root, release, privateDirectory };
}

test('production artifact refuses absent, relative, missing-parent and release-contained destinations', async () => {
  const { root, release } = await fixture();
  for (const path of [undefined, 'admin-access.json', join(root, 'absent', 'admin.json'), join(release, 'admin.json')]) {
    await expect(resolveProductionAdminArtifact(release, { ADMIN_CREDENTIALS_PATH: path })).rejects.toThrow();
  }
});

test('production artifact refuses a parent alias resolving into the release', async () => {
  const { root, release } = await fixture();
  const alias = join(root, 'alias');
  await symlink(release, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(resolveProductionAdminArtifact(release, { ADMIN_CREDENTIALS_PATH: join(alias, 'admin.json') })).rejects.toThrow();
});

test.skipIf(process.platform === 'win32')('production artifact refuses a directory readable by other users', async () => {
  const { release, privateDirectory } = await fixture();
  await chmod(privateDirectory, 0o750);
  await expect(resolveProductionAdminArtifact(release, { ADMIN_CREDENTIALS_PATH: join(privateDirectory, 'admin.json') })).rejects.toThrow();
});

test('admin artifact exclusively creates a private file and refuses to replace existing credentials', async () => {
  const { release, privateDirectory } = await fixture();
  const path = await resolveProductionAdminArtifact(release, { ADMIN_CREDENTIALS_PATH: join(privateDirectory, 'admin.json') });
  const handle = await createAdminArtifact(path);
  try {
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o777).toBe(0o600);
    await handle.writeFile('synthetic-private-credentials');
    await handle.sync();
  } finally { await handle.close(); }
  await expect(createAdminArtifact(path)).rejects.toThrow();
  expect(await readFile(path, 'utf8')).toBe('synthetic-private-credentials');
});

test.skipIf(process.platform === 'win32')('admin artifact refuses a symlink without replacing its target', async () => {
  const { privateDirectory } = await fixture();
  const target = join(privateDirectory, 'existing.json');
  const link = join(privateDirectory, 'admin.json');
  await writeFile(target, 'existing-private-credentials', { mode: 0o600 });
  await symlink(target, link);
  await expect(createAdminArtifact(link)).rejects.toThrow();
  expect(await readFile(target, 'utf8')).toBe('existing-private-credentials');
});
