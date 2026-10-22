import { app, BrowserWindow, ipcMain, net, protocol, shell, WebContents } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getCommand, register } from './registry';

import './commands/drivers';
import './commands/install';
import './commands/monitors';
import './commands/nvm';
import './commands/port';
import './commands/quick-tools';
import './commands/system-info';

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:4200';
const APP_SCHEME = 'app';
const RENDERER_ROOT = path.join(app.getAppPath(), 'dist', 'easy-start', 'browser');

let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// ---- Janela ----

function resolveIconPath(): string | undefined {
  const candidates = isDev
    ? [path.join(app.getAppPath(), 'build', 'icon.ico')]
    : [path.join(process.resourcesPath, 'icon.ico')];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Easy Start',
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: resolveIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('window-maximized', true));
  win.on('unmaximize', () => win.webContents.send('window-maximized', false));
  win.on('closed', () => {
    mainWindow = null;
  });

  // Links externos abrem no navegador, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  void win.loadURL(isDev ? DEV_URL : `${APP_SCHEME}://easy-start/`);

  return win;
}

/** Serve o build do Angular em app://easy-start/ com fallback de SPA para o index.html. */
function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const requested = path.normalize(path.join(RENDERER_ROOT, decodeURIComponent(pathname)));

    const insideRoot = requested.startsWith(RENDERER_ROOT);
    const isAsset = path.extname(requested) !== '';
    const exists = insideRoot && fs.existsSync(requested) && fs.statSync(requested).isFile();

    if (!insideRoot || (isAsset && !exists)) {
      return new Response('Not found', { status: 404 });
    }

    const file = exists ? requested : path.join(RENDERER_ROOT, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ---- Comandos (renderer -> main) ----

ipcMain.handle('invoke', async (event, command: string, args: unknown) => {
  const handler = getCommand(command);
  if (!handler) {
    return { ok: false, error: `Comando desconhecido: ${command}` };
  }

  try {
    return { ok: true, value: await handler(args ?? {}, { sender: event.sender }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

const windowOf = (sender: WebContents) => BrowserWindow.fromWebContents(sender);

register('window_minimize', (_args, { sender }) => windowOf(sender)?.minimize());
register('window_maximize', (_args, { sender }) => windowOf(sender)?.maximize());
register('window_unmaximize', (_args, { sender }) => windowOf(sender)?.unmaximize());
register('window_close', (_args, { sender }) => windowOf(sender)?.close());
register('window_is_maximized', (_args, { sender }) => windowOf(sender)?.isMaximized() ?? false);

register('app_info', () => ({ version: app.getVersion(), packaged: app.isPackaged }));

// ---- Auto-update (electron-updater + GitHub Releases) ----
// Totalmente automático: ao abrir, o app checa, baixa e instala sem pedir confirmação.

const UPDATE_RECHECK_MS = 4 * 60 * 60 * 1000;

type UpdateState =
  | { status: 'idle' | 'checking' | 'ready' | 'skipped' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'error'; message: string };

let updateState: UpdateState = { status: 'idle' };
/** Só a checagem de abertura reinicia o app na hora; as periódicas instalam ao fechar. */
let installWhenDownloaded = false;
let checkInFlight = false;

function setUpdateState(state: UpdateState): void {
  updateState = state;
  mainWindow?.webContents.send('update-state', state);
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    setUpdateState({ status: 'downloading', version: info.version, percent: 0 });
  });

  autoUpdater.on('update-not-available', () => setUpdateState({ status: 'idle' }));

  autoUpdater.on('download-progress', (progress) => {
    if (updateState.status === 'downloading') {
      setUpdateState({ ...updateState, percent: Math.floor(progress.percent) });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    setUpdateState({ status: 'ready' });
    if (installWhenDownloaded) {
      // Instalação silenciosa (sem assistente) e o app reabre sozinho.
      setImmediate(() => autoUpdater.quitAndInstall(true, true));
    }
  });

  autoUpdater.on('error', (error) => {
    checkInFlight = false;
    setUpdateState({ status: 'error', message: error?.message ?? String(error) });
  });
}

async function checkForUpdates(installNow: boolean): Promise<void> {
  if (!app.isPackaged) {
    setUpdateState({ status: 'skipped' });
    return;
  }
  // Já baixando ou pronto: não reinicia o processo de atualização.
  if (checkInFlight || updateState.status === 'downloading' || updateState.status === 'ready') {
    return;
  }

  checkInFlight = true;
  installWhenDownloaded = installNow;
  setUpdateState({ status: 'checking' });

  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // O evento 'error' já informou a interface.
  } finally {
    checkInFlight = false;
  }
}

function startAutoUpdate(): void {
  void checkForUpdates(true);
  setInterval(() => void checkForUpdates(false), UPDATE_RECHECK_MS);
}

register('update_state', () => updateState);
register('update_check', () => checkForUpdates(true));

// ---- Ciclo de vida ----

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    mainWindow = createWindow();
    setupAutoUpdater();
    mainWindow.webContents.once('did-finish-load', startAutoUpdate);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
