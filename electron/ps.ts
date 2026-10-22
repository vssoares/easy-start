import { combine, requireWindows, runPowerShell } from './exec';

const PRELUDE = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
`;

/** Escapa texto para uma string PowerShell entre aspas simples. */
export function psQuote(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Executa um script PowerShell que imprime JSON (via ConvertTo-Json) e devolve o resultado já convertido.
 * Erros do script (`throw`) viram exceções com a mensagem original.
 */
export async function psJson<T>(script: string): Promise<T> {
  requireWindows();

  const result = await runPowerShell(`${PRELUDE}\n${script}`);
  if (result.spawnError) {
    throw new Error(`Falha ao executar PowerShell: ${result.spawnError}`);
  }

  const out = result.stdout.trim();
  if (result.code !== 0 && !out) {
    throw new Error(firstLine(combine(result)) || 'O PowerShell retornou erro.');
  }
  if (!out) return null as T;

  try {
    return JSON.parse(out) as T;
  } catch {
    throw new Error(firstLine(combine(result)) || 'Resposta inválida do PowerShell.');
  }
}

/** Garante array mesmo quando o ConvertTo-Json devolve um objeto único ou nulo. */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

/** Verdadeiro quando o app roda como administrador (necessário para HKLM, drivers e pnputil). */
export async function isAdmin(): Promise<boolean> {
  const out = await psJson<boolean>(
    `[bool](([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) | ConvertTo-Json`,
  );
  return out === true;
}

export async function requireAdmin(action: string): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error(`${action} exige administrador. Feche o Easy Start e abra com "Executar como administrador".`);
  }
}
