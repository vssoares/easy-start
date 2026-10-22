import { build } from 'esbuild';
import { targets } from './electron-targets.mjs';

await Promise.all(targets.map((options) => build(options)));
