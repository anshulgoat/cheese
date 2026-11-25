// Copies the Fairy-Stockfish WASM build (GPL-3.0) from node_modules into
// public/fairy-stockfish/ so Vite serves it as static assets in dev, preview
// and production builds. Runs on postinstall / predev / prebuild.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'fairy-stockfish-nnue.wasm');
const dest = join(root, 'public', 'fairy-stockfish');
const files = ['stockfish.js', 'stockfish.wasm', 'stockfish.worker.js', 'Copying.txt', 'AUTHORS'];

if (!existsSync(src)) {
  console.warn(`[copy-engine] ${src} not found; skipping (run npm install).`);
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
let copied = 0;
for (const f of files) {
  const from = join(src, f);
  const to = join(dest, f);
  if (!existsSync(from)) continue;
  const a = statSync(from);
  if (existsSync(to)) {
    const b = statSync(to);
    if (b.size === a.size && b.mtimeMs >= a.mtimeMs) continue;
  }
  copyFileSync(from, to);
  copied++;
}
console.log(`[copy-engine] ${copied} file(s) copied to public/fairy-stockfish/`);
