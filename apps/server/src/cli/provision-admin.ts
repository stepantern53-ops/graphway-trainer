import { mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCommandConfiguration } from './environment.js';
import { createDatabase } from '../db/client.js';
import { provisionAdmin } from '../auth/admin.js';
import { createAdminArtifact, resolveProductionAdminArtifact } from './admin-artifact.js';

try {
  process.chdir(fileURLToPath(new URL('../../../../', import.meta.url)));
  const { mode, databaseUrl } = await loadCommandConfiguration(process.argv.slice(2));
  const artifact = mode === 'production' ? await resolveProductionAdminArtifact(process.cwd()) : mode === 'test' ? '.local/test-admin-access.json' : '.local/admin-access.json';
  const path = resolve(artifact);
  const database = createDatabase(databaseUrl);
  let wrote = false;
  try {
    const result = await provisionAdmin(database.pool, async credentials => {
      if (mode !== 'production') await mkdir(resolve('.local'), { recursive: true });
      const handle = await createAdminArtifact(path);
      wrote = true;
      try {
        await handle.writeFile(JSON.stringify(credentials, null, 2) + '\n');
        await handle.sync();
      } finally { await handle.close(); }
    });
    console.log(result.created ? 'Admin provisioned. Open the configured credential artifact privately.' : 'Existing admin preserved. No credentials changed.');
  } catch (error) {
    if (wrote) await unlink(path).catch(() => undefined);
    throw error;
  } finally { await database.pool.end(); }
} catch {
  console.error('Admin provisioning failed. Existing accounts and credentials were not replaced.');
  process.exitCode = 1;
}
