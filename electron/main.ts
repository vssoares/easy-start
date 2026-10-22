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

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', { percent: Math.floor(progress.percent) });
  });
}

register('update_check', async () => {
  if (!app.isPackaged) {
    return { available: false, version: null };
  }
  const result = await autoUpdater.checkForUpdates();
  return {
    available: result?.isUpdateAvailable ?? false,
    version: result?.updateInfo.version ?? null,
  };
});

register('update_download', async () => {
  await autoUpdater.downloadUpdate();
});

register('update_install', () => {
  // Instala em modo silencioso e reabre o app ao terminar.
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
});

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

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
