import { loadRuntimeEnvironment } from '../../../scripts/local-runtime.mjs';

/** Production receives its environment from the operator, never the Windows cache. */
export async function loadApplicationEnvironment(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') await loadRuntimeEnvironment();
}
