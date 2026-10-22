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

export const targets = [
  { ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' },
  { ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' },
];
