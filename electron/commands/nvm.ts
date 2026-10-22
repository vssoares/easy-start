import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { combine, isWindows, run } from '../exec';
import { registerAll } from '../registry';

const NVM_WINGET_ID = 'CoreyButler.NVMforWindows';
const NVM_SETUP_URL =
  'https://github.com/coreybutler/nvm-windows/releases/download/1.2.2/nvm-setup.exe';

interface NvmStatus {
  installed: boolean;
  nvmPath: string | null;
  nvmVersion: string | null;
  currentVersion: string | null;
}

interface NodeVersionInfo {
  version: string;
  installed: boolean;
  active: boolean;
  lts: string | null;
}

interface NodeVersionsResponse {
  status: NvmStatus;
  installed: NodeVersionInfo[];
  available: NodeVersionInfo[];
}

function findNvmExe(): string | null {
  const candidates = [
    process.env['NVM_HOME'] && path.join(process.env['NVM_HOME'], 'nvm.exe'),
    'C:\\Program Files\\nvm\\nvm.exe',
    process.env['APPDATA'] && path.join(process.env['APPDATA'], 'nvm', 'nvm.exe'),
  ];

  return candidates.find((candidate): candidate is string => !!candidate && fs.existsSync(candidate)) ?? null;
}

async function runNvm(args: string[]): Promise<string> {
  const nvm = findNvmExe();
  if (!nvm) {
    throw new Error('NVM for Windows não encontrado.');
  }

  const nvmDir = path.dirname(nvm);
  const result = await run(nvm, args, {
    cwd: nvmDir,
    env: {
      ...process.env,
      NVM_HOME: process.env['NVM_HOME'] ?? nvmDir,
      NVM_SYMLINK: process.env['NVM_SYMLINK'] ?? 'C:\\Program Files\\nodejs',
    },
  });

  if (result.spawnError) {
    throw new Error(`Falha ao executar nvm: ${result.spawnError}`);
  }

  const combined = combine(result);
  if (result.code !== 0) {
    throw new Error(combined || `nvm falhou com código ${result.code}`);
  }
  return combined;
}

const normalizeVersion = (version: string): string => version.trim().replace(/^v/, '');

function parseInstalledVersions(output: string): { version: string; active: boolean }[] {
  const versions: { version: string; active: boolean }[] = [];

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const active = trimmed.startsWith('*');
    const token = trimmed.replace(/^\*+/, '').trim().split(/\s+/)[0] ?? '';

    if (/^\d/.test(token)) {
      versions.push({ version: normalizeVersion(token), active });
    }
  }

  return versions;
}

const isStableSemver = (version: string): boolean => /^\d+\.\d+\.\d+$/.test(normalizeVersion(version));

const majorVersion = (version: string): number => Number.parseInt(normalizeVersion(version), 10);

/** Ordem decrescente de versão (a mais nova primeiro). */
function compareVersionsDesc(a: string, b: string): number {
  const parse = (value: string) => normalizeVersion(value).split('.').map((part) => Number(part) || 0);
  const pa = parse(a);
  const pb = parse(b);

  for (let i = 0; i < 3; i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchAvailableVersions(): Promise<{ version: string; lts: string }[]> {
  let entries: { version: string; lts: unknown }[];

  try {
    const response = await fetch('https://nodejs.org/dist/index.json', {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Resposta inválida do nodejs.org: ${response.status}`);
    }
    entries = (await response.json()) as { version: string; lts: unknown }[];
  } catch (error) {
    throw new Error(`Falha ao buscar versões do Node: ${(error as Error).message}`);
  }

  // Mantém apenas a versão LTS mais recente de cada major.
  const byMajor = new Map<number, { version: string; lts: string }>();

  for (const entry of entries) {
    const version = normalizeVersion(entry.version);
    if (!isStableSemver(version)) continue;

    const lts = entry.lts === true ? 'LTS' : typeof entry.lts === 'string' && entry.lts ? entry.lts : null;
    if (!lts) continue;

    const major = majorVersion(version);
    const current = byMajor.get(major);
    if (!current || compareVersionsDesc(version, current.version) < 0) {
      byMajor.set(major, { version, lts });
    }
  }

  return [...byMajor.values()].sort((a, b) => compareVersionsDesc(a.version, b.version));
}

async function installNvmWindows(): Promise<void> {
  if (findNvmExe()) return;

  const winget = await run('winget', [
    'install',
    '-e',
    '--id',
    NVM_WINGET_ID,
    '--silent',
    '--accept-package-agreements',
    '--accept-source-agreements',
    '--disable-interactivity',
  ]);
  if (winget.code === 0 || findNvmExe()) return;

  const installer = path.join(os.tmpdir(), 'nvm-setup.exe');

  try {
    const response = await fetch(NVM_SETUP_URL, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) {
      throw new Error(`Download do NVM inválido: ${response.status}`);
    }
    await fs.promises.writeFile(installer, Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    throw new Error(`Falha ao baixar NVM: ${(error as Error).message}`);
  }

  const setup = await run(installer, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART']);
  await fs.promises.rm(installer, { force: true });

  if (setup.code !== 0 && !findNvmExe()) {
    throw new Error('Instalação do NVM for Windows falhou.');
  }
}

async function buildStatus(listOutput: string | null): Promise<NvmStatus> {
  const nvmPath = findNvmExe();
  if (!nvmPath) {
    return { installed: false, nvmPath: null, nvmVersion: null, currentVersion: null };
  }

  const nvmVersion = await runNvm(['version']).catch(() => null);

  const activeFromList = listOutput
    ? parseInstalledVersions(listOutput).find((entry) => entry.active)?.version
    : undefined;

  const currentVersion =
    activeFromList ??
    (await runNvm(['current'])
      .then(normalizeVersion)
      .catch(() => null));

  return { installed: true, nvmPath, nvmVersion, currentVersion };
}

async function buildVersionsResponse(): Promise<NodeVersionsResponse> {
  const listOutput = findNvmExe() ? await runNvm(['list']).catch(() => null) : null;
  const status = await buildStatus(listOutput);

  const installedPairs = status.installed && listOutput ? parseInstalledVersions(listOutput) : [];
  const installedSet = new Set(installedPairs.map((entry) => entry.version));

  const installed: NodeVersionInfo[] = installedPairs.map(({ version, active }) => ({
    version,
    installed: true,
    active,
    lts: null,
  }));

  const available: NodeVersionInfo[] = (await fetchAvailableVersions()).map(({ version, lts }) => ({
    version,
    installed: installedSet.has(version),
    active: status.currentVersion === version,
    lts,
  }));

  return { status, installed, available };
}

const withVersion =
  (action: string, hint = '') =>
  async ({ version }: { version: string }) => {
    try {
      await runNvm([action, normalizeVersion(version)]);
    } catch (error) {
      throw new Error(`${(error as Error).message}${hint}`);
    }
    return buildVersionsResponse();
  };

registerAll({
  node_manager_supported: () => isWindows,

  nvm_status: () => buildStatus(null),

  async ensure_nvm() {
    await installNvmWindows();
    return buildVersionsResponse();
  },

  list_node_versions: () => buildVersionsResponse(),

  install_node_version: withVersion('install'),

  uninstall_node_version: withVersion('uninstall'),

  use_node_version: withVersion(
    'use',
    '\n\nDica: execute o app como administrador ou ative o Modo Desenvolvedor do Windows.',
  ),
});
