# Engine layer (Fairy-Stockfish, 3check)

The AI opponent is [Fairy-Stockfish](https://github.com/fairy-stockfish/fairy-stockfish.wasm)
(`fairy-stockfish-nnue.wasm`), compiled to WebAssembly with pthreads.

**License:** Fairy-Stockfish is GPL-3.0 (see `node_modules/fairy-stockfish-nnue.wasm/Copying.txt`,
which is also shipped to `public/fairy-stockfish/Copying.txt`). Distributing this app with
the engine means the app must be distributed under GPL-3.0-compatible terms, with source available.

## Usage

```ts
import { createEngine, isEngineAbort } from './engine/EngineClient';
import { levelLabel } from './engine/difficulty';

const engine = createEngine();
await engine.init();            // rejects with a clear message if not crossOriginIsolated
engine.setLevel(3);             // 1..8, levelLabel(3) === 'Level 3 · Casual'
try {
  const uci = await engine.bestMove(['e2e4', 'e7e5']); // e.g. "g1f3"
} catch (e) {
  if (!isEngineAbort(e)) throw e; // superseded by a newer bestMove(), stop() or terminate()
}
engine.terminate();             // on unmount
```

## How it loads

- `scripts/copy-engine.mjs` (postinstall / predev / prebuild) copies the engine into
  `public/fairy-stockfish/` (git-ignored), so it is served at `${BASE_URL}fairy-stockfish/`.
- `init()` injects `stockfish.js` as a classic `<script>` (defines a global `Stockfish`
  factory) and calls it with `locateFile` / `mainScriptUrlOrBlob` pointing at that directory,
  so `stockfish.wasm` and the pthread `stockfish.worker.js` resolve correctly. The search runs
  in pthread workers, not on the UI thread.
- Requires `SharedArrayBuffer` → the page must be cross-origin isolated:
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
  (set in `vite.config.ts` for dev/preview; **static hosting must send them too**). Also needs
  WASM SIMD (Chrome 91+, Firefox 89+, Safari 16.4+).

## Testing

`npm run engine:smoke` runs the same WASM build under Node and checks 3check behaviour.
Fairy-Stockfish's 3check FEN puts the *remaining* checks after the en-passant field
(`... w KQkq - 3+3 0 1`); it also accepts the lichess `+given+given` suffix.
