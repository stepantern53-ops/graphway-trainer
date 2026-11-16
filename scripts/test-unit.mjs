import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const forwarded = process.argv.slice(2);
const hasProject = forwarded.some((arg) => arg === '--project' || arg.startsWith('--project='));
const projects = ['math-core', 'contracts', 'curriculum', 'web'];
const args = ['run', ...(hasProject ? [] : projects.flatMap((project) => ['--project', project])), ...forwarded];
const vitestCli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const child = spawn(process.execPath, [vitestCli, ...args], { cwd: process.cwd(), stdio: 'inherit', windowsHide: true, shell: false });
child.once('error', (error) => {
  console.error(`Unable to start Vitest: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
