import { app } from 'electron';
import path from 'node:path';
import { requireWindows, run } from '../exec';
import { registerAll } from '../registry';

function scriptPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'monitors.ps1')
    : path.join(app.getAppPath(), 'electron', 'native', 'monitors.ps1');
}

/**
 * A manipulação de monitores usa a API de vídeo do Windows (SetDisplayConfig),
 * compilada sob demanda pelo PowerShell em `electron/native/monitors.ps1`.
 */
async function runMonitors<T>(action: 'list' | 'enable' | 'disable' | 'primary', id = ''): Promise<T> {
  requireWindows();

  const result = await run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath(),
    '-Action',
    action,
    '-Id',
    id,
  ]);

  if (result.spawnError) {
    throw new Error(`Falha ao executar PowerShell: ${result.spawnError}`);
  }

  let payload: any;
  try {
    payload = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(result.stderr.trim() || 'Resposta inválida ao consultar monitores.');
  }

  if (payload && !Array.isArray(payload) && typeof payload.error === 'string') {
    throw new Error(payload.error);
  }
  return payload as T;
}

registerAll({
  list_monitors: () => runMonitors('list'),

  set_monitor_enabled: ({ monitorId, enabled }: { monitorId: string; enabled: boolean }) =>
    runMonitors(enabled ? 'enable' : 'disable', String(monitorId).trim()),

  set_primary_monitor: ({ monitorId }: { monitorId: string }) =>
    runMonitors('primary', String(monitorId).trim()),
});
