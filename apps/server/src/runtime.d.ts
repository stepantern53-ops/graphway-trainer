declare module '*local-runtime.mjs' {
  export function loadRuntimeEnvironment(): Promise<Readonly<Record<string, string>>>;
}
