import { combine, run } from '../exec';
import { registerAll } from '../registry';

interface InstallRequest {
  appId: string;
  name: string;
  wingetId: string;
}

type JobStatus = 'installing' | 'done' | 'skipped' | 'failed';

async function wingetAvailable(): Promise<boolean> {
  const result = await run('winget', ['--version']);
  return result.code === 0 && !result.spawnError;
}

const ALREADY_INSTALLED_MARKERS = [
  'already installed',
  'já instalado',
  'no available upgrade',
  'nenhuma atualização disponível',
  'no updates available',
];

async function runWingetInstall(wingetId: string): Promise<{ ok: boolean; message: string }> {
  const result = await run('winget', [
    'install',
    '--id',
    wingetId,
    '--exact',
    '--silent',
    '--accept-package-agreements',
    '--accept-source-agreements',
    '--disable-interactivity',
  ]);

  if (result.spawnError) {
    return { ok: false, message: `Falha ao executar winget: ${result.spawnError}` };
  }

  const combined = combine(result);

  if (result.code === 0) {
    return { ok: true, message: combined || 'Instalado com sucesso' };
  }

  const lower = combined.toLowerCase();
  if (ALREADY_INSTALLED_MARKERS.some((marker) => lower.includes(marker))) {
    return { ok: true, message: 'Já instalado / atualizado' };
  }

  return { ok: false, message: combined || `winget saiu com código ${result.code}` };
}

registerAll({
  check_winget: () => wingetAvailable(),

  async install_apps({ apps }: { apps: InstallRequest[] }, { sender }) {
    if (!(await wingetAvailable())) {
      throw new Error('winget não encontrado. Instale o App Installer da Microsoft Store.');
    }

    const total = apps.length;
    const emit = (item: InstallRequest, status: JobStatus, message: string, index: number) => {
      if (!sender.isDestroyed()) {
        sender.send('install-progress', {
          appId: item.appId,
          name: item.name,
          status,
          message,
          index,
          total,
        });
      }
    };

    const jobs = [];
    for (const [i, item] of apps.entries()) {
      emit(item, 'installing', 'Instalando...', i + 1);

      const outcome = await runWingetInstall(item.wingetId);
      const status: JobStatus = !outcome.ok
        ? 'failed'
        : outcome.message.includes('Já instalado')
          ? 'skipped'
          : 'done';

      jobs.push({
        appId: item.appId,
        name: item.name,
        wingetId: item.wingetId,
        status,
        message: outcome.message,
      });
      emit(item, status, outcome.message, i + 1);
    }

    return { jobs, wingetAvailable: true };
  },
});
