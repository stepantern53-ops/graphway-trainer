import { execFile } from 'node:child_process';
import { chmod, open, realpath, stat, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function resolveProductionAdminArtifact(releaseRoot: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const path = env.ADMIN_CREDENTIALS_PATH;
  if (!path || !isAbsolute(path)) throw new Error('Production admin requires an absolute private artifact path.');
  const parent = await realpath(dirname(path));
  const root = await realpath(releaseRoot);
  const fromRoot = relative(root, parent);
  if (!fromRoot || (fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot))) throw new Error('Admin artifact must be outside the release.');
  const directory = await stat(parent);
  if (!directory.isDirectory() || (process.platform !== 'win32' && (directory.uid !== process.geteuid!() || (directory.mode & 0o777) !== 0o700))) throw new Error('Admin artifact requires an owner-only private directory.');
  return join(parent, basename(path));
}

/** Exclusive creation; permissions are restricted before a caller can write credentials. */
export async function createAdminArtifact(path: string) {
  const handle = await open(path, 'wx', 0o600);
  try {
    if (process.platform !== 'win32') {
      await chmod(path, 0o600);
    } else {
      // Path is a child-process environment value, never interpolated or printed.
      await exec('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; $p=$env:GRAPHWAY_ACL_PATH; $u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=Get-Acl -LiteralPath $p; $acl.SetAccessRuleProtection($true,$false); foreach($r in @($acl.Access)){$acl.RemoveAccessRuleAll($r)}; $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($u,'FullControl','Allow'); $acl.SetAccessRule($rule); Set-Acl -LiteralPath $p -AclObject $acl"], { windowsHide: true, env: { ...process.env, GRAPHWAY_ACL_PATH: path } });
    }
    return handle;
  } catch (error) {
    await handle.close();
    await unlink(path);
    throw error;
  }
}
