import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // electron-updater fica fora do bundle: o electron-builder o empacota via node_modules.
  external: ['electron', 'electron-updater'],
  sourcemap: true,
  logLevel: 'info',
};

const targets = [
  { ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' },
  { ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' },
];

if (watch) {
  const contexts = await Promise.all(targets.map((options) => context(options)));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('Observando electron/ para mudanças...');
} else {
  await Promise.all(targets.map((options) => build(options)));
}
