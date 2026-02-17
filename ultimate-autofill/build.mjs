import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  sourcemap: true,
  target: 'es2022',
  tsconfig: resolve(__dirname, 'tsconfig.json'),
};

const entries = [
  { in: 'src/background/serviceWorker.ts', out: 'background', fmt: 'esm' },
  { in: 'src/content/main.ts', out: 'content', fmt: 'iife' },
  { in: 'src/content/overlay.ts', out: 'overlay', fmt: 'iife' },
  { in: 'src/ui/popup/popup.ts', out: 'popup', fmt: 'iife' },
  { in: 'src/ui/options/options.ts', out: 'options', fmt: 'iife' },
];

async function build() {
  const dist = resolve(__dirname, 'dist');
  mkdirSync(dist, { recursive: true });

  // Copy static files
  cpSync(resolve(__dirname, 'public'), dist, { recursive: true });
  cpSync(resolve(__dirname, 'src/manifest.json'), resolve(dist, 'manifest.json'));

  for (const e of entries) {
    const opts = {
      ...shared,
      entryPoints: [resolve(__dirname, e.in)],
      outfile: resolve(dist, `${e.out}.js`),
      format: e.fmt,
    };
    if (isWatch) {
      const ctx = await esbuild.context(opts);
      await ctx.watch();
      console.log(`Watching ${e.out}...`);
    } else {
      await esbuild.build(opts);
      console.log(`Built ${e.out}.js`);
    }
  }
  if (!isWatch) console.log('Build complete.');
}

build().catch((e) => { console.error(e); process.exit(1); });
