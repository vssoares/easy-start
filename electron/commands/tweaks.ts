import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { requireWindows, run } from '../exec';
import { psJson, requireAdmin } from '../ps';
import { registerAll } from '../registry';

type Hive = 'HKCU' | 'HKLM';
type Backup = Record<string, string>;

const ABSENT = '<ausente>';
const HIGH_PERFORMANCE = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';
const DX_PATH = 'Software\\Microsoft\\DirectX\\UserGpuPreferences';
const MOUSE_PATH = 'Control Panel\\Mouse';

const backupFile = () => path.join(app.getPath('userData'), 'tweak-backup.json');

function readBackup(): Backup {
  try {
    return JSON.parse(fs.readFileSync(backupFile(), 'utf8')) as Backup;
  } catch {
    return {};
  }
}

function writeBackup(backup: Backup): void {
  fs.mkdirSync(path.dirname(backupFile()), { recursive: true });
  fs.writeFileSync(backupFile(), JSON.stringify(backup, null, 2));
}

// ---- Registro (reg.exe) ----

const fullKey = (hive: Hive, key: string) => `${hive}\\${key}`;

async function regRead(hive: Hive, key: string, name: string): Promise<string | null> {
  const result = await run('reg', ['query', fullKey(hive, key), '/v', name]);
  if (result.code !== 0) return null;

  const line = result.stdout.split(/\r?\n/).find((l) => l.trim().startsWith(name));
  if (!line) return null;

  const match = line.trim().match(/^.+?\s{2,}REG_\w+\s{2,}(.*)$/) ?? line.trim().match(/^.+?\s+REG_\w+\s+(.*)$/);
  return match ? match[1].trim() : null;
}

async function regReadDword(hive: Hive, key: string, name: string): Promise<number | null> {
  const raw = await regRead(hive, key, name);
  if (raw === null) return null;
  const value = Number.parseInt(raw, raw.toLowerCase().startsWith('0x') ? 16 : 10);
  return Number.isNaN(value) ? null : value;
}

async function regWrite(hive: Hive, key: string, name: string, type: 'REG_DWORD' | 'REG_SZ', value: string | number) {
  const result = await run('reg', ['add', fullKey(hive, key), '/v', name, '/t', type, '/d', String(value), '/f']);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `Não foi possível gravar ${name} no registro.`);
  }
}

async function regDelete(hive: Hive, key: string, name: string) {
  await run('reg', ['delete', fullKey(hive, key), '/v', name, '/f']);
}

/** Guarda o valor original na primeira alteração, para "Restaurar originais". */
async function remember(backup: Backup, id: string, hive: Hive, key: string, name: string): Promise<void> {
  if (id in backup) return;
  backup[id] = (await regRead(hive, key, name)) ?? ABSENT;
}

async function restoreValue(backup: Backup, id: string, hive: Hive, key: string, name: string, type: 'REG_DWORD' | 'REG_SZ') {
  const prev = backup[id];
  if (prev === undefined) return;
  if (prev === ABSENT) await regDelete(hive, key, name);
  else await regWrite(hive, key, name, type, type === 'REG_DWORD' ? Number.parseInt(prev, prev.startsWith('0x') ? 16 : 10) : prev);
}

// ---- Plano de energia ----

async function powercfg(...args: string[]): Promise<string> {
  const result = await run('powercfg', args);
  return result.stdout;
}

async function activeScheme(): Promise<string | null> {
  const match = (await powercfg('/getactivescheme')).match(/[0-9a-fA-F-]{36}/);
  return match ? match[0].toLowerCase() : null;
}

// ---- Configurações do DirectX (jogos em janela) ----

async function dxSettings(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const raw = (await regRead('HKCU', DX_PATH, 'DirectXUserGlobalSettings')) ?? '';
  for (const part of raw.split(';')) {
    const [key, value] = part.split('=');
    if (key?.trim() && value !== undefined) map.set(key.trim(), value.trim());
  }
  return map;
}

const serializeDx = (map: Map<string, string>) => [...map].map(([k, v]) => `${k}=${v};`).join('');

async function applyMouse(values: [string, string, string]): Promise<void> {
  await regWrite('HKCU', MOUSE_PATH, 'MouseSpeed', 'REG_SZ', values[0]);
  await regWrite('HKCU', MOUSE_PATH, 'MouseThreshold1', 'REG_SZ', values[1]);
  await regWrite('HKCU', MOUSE_PATH, 'MouseThreshold2', 'REG_SZ', values[2]);

  // Aplica na hora, sem precisar sair da conta (SPI_SETMOUSE).
  await psJson(`
Add-Type -Namespace Win32 -Name Spi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint a, uint b, int[] c, uint d);'
[void][Win32.Spi]::SystemParametersInfo(0x0004, 0, [int[]]@(${values.join(',')}), 3)
'true'`);
}

// ---- Definição dos ajustes ----

interface TweakDef {
  id: string;
  title: string;
  description: string;
  effect: string;
  needsRestart: boolean;
  needsAdmin: boolean;
  read: () => Promise<boolean>;
  write: (on: boolean, backup: Backup) => Promise<void>;
  restore: (backup: Backup) => Promise<void>;
}

function dwordTweak(
  id: string,
  title: string,
  description: string,
  effect: string,
  hive: Hive,
  key: string,
  name: string,
  on: number,
  off: number,
  absentMeansOn: boolean,
  needsRestart = false,
): TweakDef {
  return {
    id,
    title,
    description,
    effect,
    needsRestart,
    needsAdmin: hive === 'HKLM',
    read: async () => {
      const value = await regReadDword(hive, key, name);
      return value === null ? absentMeansOn : value === on;
    },
    write: async (enable, backup) => {
      await remember(backup, id, hive, key, name);
      await regWrite(hive, key, name, 'REG_DWORD', enable ? on : off);
    },
    restore: (backup) => restoreValue(backup, id, hive, key, name, 'REG_DWORD'),
  };
}

const GAME_DVR_A = ['HKCU', 'System\\GameConfigStore', 'GameDVR_Enabled'] as const;
const GAME_DVR_B = ['HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled'] as const;

const TWEAKS: TweakDef[] = [
  {
    id: 'power',
    title: 'Plano de energia: Alto desempenho',
    description: 'Mantém a CPU pronta para subir o clock na hora, sem economia agressiva de energia.',
    effect: 'Menos engasgos e 1% low melhor em alguns jogos. Em notebooks gasta mais bateria.',
    needsRestart: false,
    needsAdmin: false,
    read: async () => (await activeScheme()) === HIGH_PERFORMANCE,
    write: async (on, backup) => {
      if (!('power' in backup)) backup['power'] = (await activeScheme()) ?? BALANCED;
      if (on) {
        // Alguns PCs vêm sem o plano listado: duplicar o modelo padrão o recria com o mesmo GUID.
        if (!(await powercfg('/list')).toLowerCase().includes(HIGH_PERFORMANCE)) {
          await powercfg('-duplicatescheme', HIGH_PERFORMANCE, HIGH_PERFORMANCE);
        }
        await powercfg('/setactive', HIGH_PERFORMANCE);
      } else {
        const prev = backup['power'];
        await powercfg('/setactive', prev && prev !== HIGH_PERFORMANCE ? prev : BALANCED);
      }
    },
    restore: async (backup) => {
      if (backup['power']) await powercfg('/setactive', backup['power']);
    },
  },
  dwordTweak(
    'gamemode',
    'Modo de Jogo',
    'Dá prioridade ao jogo e evita que o Windows Update instale ou reinicie durante a partida.',
    'Recomendado ligado (é o padrão do Windows 11).',
    'HKCU',
    'Software\\Microsoft\\GameBar',
    'AutoGameModeEnabled',
    1,
    0,
    true,
  ),
  {
    id: 'gamedvr',
    title: 'Desativar gravação em segundo plano (Game DVR)',
    description: 'Desliga a captura contínua do Xbox Game Bar, que grava os últimos minutos de jogo o tempo todo.',
    effect: 'Recupera alguns FPS e reduz uso de GPU/disco. Você perde o "gravar o que aconteceu" do Game Bar.',
    needsRestart: false,
    needsAdmin: false,
    read: async () =>
      ((await regReadDword(...GAME_DVR_A)) ?? 1) === 0 && ((await regReadDword(...GAME_DVR_B)) ?? 1) === 0,
    write: async (on, backup) => {
      await remember(backup, 'gamedvr.a', ...GAME_DVR_A);
      await remember(backup, 'gamedvr.b', ...GAME_DVR_B);
      await regWrite(...GAME_DVR_A, 'REG_DWORD', on ? 0 : 1);
      await regWrite(...GAME_DVR_B, 'REG_DWORD', on ? 0 : 1);
    },
    restore: async (backup) => {
      await restoreValue(backup, 'gamedvr.a', ...GAME_DVR_A, 'REG_DWORD');
      await restoreValue(backup, 'gamedvr.b', ...GAME_DVR_B, 'REG_DWORD');
    },
  },
  dwordTweak(
    'hags',
    'Agendamento de GPU acelerado por hardware',
    'A própria placa de vídeo gerencia sua fila de trabalho, em vez da CPU.',
    'Necessário para o Frame Generation do DLSS 3/4. Pode reduzir latência. Requer GPU e driver compatíveis.',
    'HKLM',
    'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers',
    'HwSchMode',
    2,
    1,
    false,
    true,
  ),
  {
    id: 'windowed',
    title: 'Otimizações para jogos em janela',
    description: 'Faz jogos DirectX 10/11 em janela ou "sem bordas" usarem o modelo de apresentação moderno (flip).',
    effect: 'Menor latência e suporte a VRR/G-Sync em janela. Recurso do Windows 11.',
    needsRestart: false,
    needsAdmin: false,
    read: async () => (await dxSettings()).get('SwapEffectUpgradeEnable') === '1',
    write: async (on, backup) => {
      await remember(backup, 'windowed', 'HKCU', DX_PATH, 'DirectXUserGlobalSettings');
      const settings = await dxSettings();
      settings.set('SwapEffectUpgradeEnable', on ? '1' : '0');
      await regWrite('HKCU', DX_PATH, 'DirectXUserGlobalSettings', 'REG_SZ', serializeDx(settings));
    },
    restore: (backup) => restoreValue(backup, 'windowed', 'HKCU', DX_PATH, 'DirectXUserGlobalSettings', 'REG_SZ'),
  },
  {
    id: 'mouse',
    title: 'Desligar aceleração do mouse',
    description: 'Desmarca "Aprimorar precisão do ponteiro": o cursor anda sempre a mesma distância para o mesmo movimento.',
    effect: 'Não muda FPS, mas deixa a mira consistente em jogos de tiro.',
    needsRestart: false,
    needsAdmin: false,
    read: async () => (await regRead('HKCU', MOUSE_PATH, 'MouseSpeed')) === '0',
    write: async (on, backup) => {
      for (const name of ['MouseSpeed', 'MouseThreshold1', 'MouseThreshold2']) {
        await remember(backup, `mouse.${name}`, 'HKCU', MOUSE_PATH, name);
      }
      await applyMouse(on ? ['0', '0', '0'] : ['1', '6', '10']); // padrão do Windows quando desligado
    },
    restore: async (backup) => {
      if (!('mouse.MouseSpeed' in backup)) return;
      const value = (name: string) => (backup[`mouse.${name}`] === ABSENT ? '0' : (backup[`mouse.${name}`] ?? '0'));
      await applyMouse([value('MouseSpeed'), value('MouseThreshold1'), value('MouseThreshold2')]);
    },
  },
];

async function snapshot() {
  return Promise.all(
    TWEAKS.map(async (t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      effect: t.effect,
      needsRestart: t.needsRestart,
      needsAdmin: t.needsAdmin,
      isOn: await t.read(),
    })),
  );
}

registerAll({
  async list_tweaks() {
    requireWindows();
    return snapshot();
  },

  async set_tweak({ id, enabled }: { id: string; enabled: boolean }) {
    requireWindows();
    const tweak = TWEAKS.find((t) => t.id === id);
    if (!tweak) throw new Error(`Ajuste desconhecido: ${id}`);
    if (tweak.needsAdmin) await requireAdmin(`"${tweak.title}"`);

    const backup = readBackup();
    await tweak.write(enabled, backup);
    writeBackup(backup);

    return {
      message: tweak.needsRestart ? `${tweak.title}: reinicie o PC para valer.` : `${tweak.title}: ${enabled ? 'ativado' : 'desativado'}.`,
    };
  },

  async restore_tweaks() {
    requireWindows();
    const backup = readBackup();
    const errors: string[] = [];

    for (const tweak of TWEAKS) {
      try {
        await tweak.restore(backup);
      } catch (error) {
        errors.push(`${tweak.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    writeBackup({});
    return {
      message: errors.length ? `Restaurado, com falhas: ${errors.join(' ')}` : 'Valores originais restaurados.',
    };
  },
});
