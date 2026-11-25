# Three-Check Chess

Regular chess, plus one rule: **give three checks and you win.**

Play over the board against a friend, or against [Fairy-Stockfish](https://github.com/fairy-stockfish/fairy-stockfish.wasm) running in your browser (8 levels).

## Run

```sh
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the build |
| `npm test` | Rules tests |
| `npm run engine:smoke` | Engine smoke test (Node) |

## Deploying

The engine needs `SharedArrayBuffer`, so the host must send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Stack

React · TypeScript · Vite · [chessops](https://github.com/niklasf/chessops) · [chessground](https://github.com/lichess-org/chessground) · Fairy-Stockfish WASM (GPL-3.0)
