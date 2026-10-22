import { execFile, ExecFileOptions, spawn } from 'node:child_process';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  /** Preenchido quando o processo não pôde ser iniciado. */
  spawnError?: string;
}

/** Executa um processo sem janela e nunca rejeita: falhas vêm em `code`/`spawnError`. */
export function run(
  file: string,
  args: string[] = [],
  options: ExecFileOptions = {},
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options },
      (error, stdout, stderr) => {
        const out = String(stdout ?? '');
        const err = String(stderr ?? '');
        if (!error) {
          resolve({ code: 0, stdout: out, stderr: err });
          return;
        }
        const code = typeof error.code === 'number' ? error.code : -1;
        resolve({
          code,
          stdout: out,
          stderr: err,
          spawnError: typeof error.code === 'string' ? error.message : undefined,
        });
      },
    );
  });
}

/** Dispara um processo desacoplado (ex.: abrir uma ferramenta do Windows). */
export function launch(file: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export function combine(result: ExecResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
}

/** Executa um script PowerShell via -EncodedCommand (evita problemas de aspas/UTF-8). */
export function runPowerShell(script: string): Promise<ExecResult> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return run('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded]);
}

export const isWindows = process.platform === 'win32';

export const WINDOWS_ONLY = 'Disponível apenas no Windows.';

export function requireWindows(): void {
  if (!isWindows) {
    throw new Error(WINDOWS_ONLY);
  }
}
