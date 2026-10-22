import { spawn, spawnSync } from 'node:child_process';
import { context } from 'esbuild';
import waitOn from 'wait-on';
import { targets } from './electron-targets.mjs';

// Sobe o ng serve (HMR do Angular) e o Electron, que reinicia sozinho quando electron/ muda.

const DEV_PORT = 4200;
const isWindows = process.platform === 'win32';

let electron = null;
let restarting = false;
let shuttingDown = false;

const kill = (child) => {
  if (!child?.pid) return;
  if (isWindows) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
};

const ng = spawn('npx', ['ng', 'serve'], { stdio: 'inherit', shell: true });

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  kill(electron);
  kill(ng);
  process.exit(code);
};

ng.on('exit', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

function startElectron() {
  const child = spawn('npx', ['electron', '.', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });
  electron = child;

  child.on('exit', () => {
    if (electron !== child) return;
    // Fechar a janela encerra o dev; um reinício disparado por mudança de código não.
    if (!restarting) shutdown();
  });
}

function restartElectron() {
  restarting = true;
  const previous = electron;
  electron = null;
  kill(previous);
  setTimeout(() => {
    restarting = false;
    startElectron();
  }, 400);
}

await waitOn({ resources: [`tcp:${DEV_PORT}`] });

let firstBuild = true;
const restartPlugin = {
  name: 'restart-electron',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      // main e preload buildam em paralelo: agrupa os dois rebuilds num único reinício.
      clearTimeout(restartPlugin.timer);
      restartPlugin.timer = setTimeout(() => {
        if (firstBuild) {
          firstBuild = false;
          startElectron();
        } else {
          console.log('\n[dev] electron/ mudou, reiniciando o Electron...');
          restartElectron();
        }
      }, 150);
    });
  },
};

const contexts = await Promise.all(
  targets.map((options) => context({ ...options, plugins: [restartPlugin] })),
);
await Promise.all(contexts.map((ctx) => ctx.watch()));
console.log('[dev] Observando electron/ — o Electron reinicia ao salvar.');
