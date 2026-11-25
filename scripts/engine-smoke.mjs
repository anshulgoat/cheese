// Smoke test: runs the same Fairy-Stockfish WASM build the browser uses, under
// Node (worker_threads provide the pthreads), and checks 3check behaviour.
//   npm run engine:smoke
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('fairy-stockfish-nnue.wasm/stockfish.js'));
const Stockfish = require(join(pkgDir, 'stockfish.js'));

// Node >= 18 has a global fetch, which makes Emscripten try to fetch() a file
// path for the wasm; handing it the bytes directly avoids that.
const sf = await Stockfish({ wasmBinary: readFileSync(join(pkgDir, 'stockfish.wasm')) });

let waiters = [];
const log = [];
sf.addMessageListener((line) => {
  log.push(line);
  for (const w of [...waiters]) {
    if (w.match(line)) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(line);
    }
  }
});
function send(cmd, match, timeoutMs = 20000) {
  const p = match
    ? new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout waiting after "${cmd}"`)), timeoutMs);
        waiters.push({ match, resolve: (l) => (clearTimeout(t), resolve(l)) });
      })
    : Promise.resolve();
  sf.postMessage(cmd);
  return p;
}
const bestmove = async (position, go = 'go movetime 500') => {
  await send(position);
  const line = await send(go, (l) => l.startsWith('bestmove'));
  return line.split(/\s+/)[1];
};
/** Returns the FEN the engine parsed (via the `d` command). */
const engineFen = async (position) => {
  await send(position);
  return (await send('d', (l) => l.startsWith('Fen:'))).slice(5).trim();
};

let failed = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
}

// Legality via chessops (standard chess rules; the check-count field is stripped).
function playStd(fen, uci) {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const move = parseUci(uci);
  if (!move || !pos.isLegal(move)) return null;
  pos.play(move);
  return pos;
}

try {
  const id = await send('uci', (l) => l === 'uciok');
  check('uci handshake', !!id, log.find((l) => l.startsWith('id name')));
  await send('setoption name UCI_Variant value 3check');
  await send('isready', (l) => l === 'readyok');
  check('UCI_Variant 3check accepted', !log.some((l) => /No such option|Unknown/i.test(l)));

  const startFen = await engineFen('position startpos');
  check('startpos is 3check (remaining-checks field 3+3)', / 3\+3 /.test(startFen), startFen);

  // (a) legal bestmove from the start position
  const STD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const m1 = await bestmove('position startpos');
  check('legal bestmove from startpos', !!playStd(STD_START, m1), m1);

  // FEN format: Fairy-Stockfish uses "remaining checks" W+B after the ep field,
  // e.g. "... w KQkq - 1+3 0 2" = white needs 1 more check, black needs 3.
  // It also accepts the lichess suffix "+2+0" (checks already GIVEN).
  // After 1.e4 d6 white can give check with Bb5+ or Qa4+ (d7 is empty).
  const board = 'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -';
  const fenRemaining = `${board} 1+3 0 2`;
  const fenLichess = `${board} 0 2 +2+0`;
  const parsedA = await engineFen(`position fen ${fenRemaining}`);
  const parsedB = await engineFen(`position fen ${fenLichess}`);
  check('accepts "W+B remaining" check field', / 1\+3 /.test(parsedA), parsedA);
  check('accepts lichess "+given+given" suffix', / 1\+3 /.test(parsedB), parsedB);

  // (b) with 2 checks already given, the engine must deliver the 3rd (winning) check
  for (const [label, fen] of [
    ['remaining format', fenRemaining],
    ['lichess format', fenLichess],
  ]) {
    const mv = await bestmove(`position fen ${fen}`, 'go depth 6');
    const after = playStd(`${board} 0 2`, mv);
    check(`plays the 3rd (winning) check [${label}]`, !!after && after.isCheck(), mv);
  }
  // Same position via startpos + moves (the form EngineClient uses): checks given by moves.
  // 1.e4 d6 2.Bb5+ c6 3.Bxc6+ Nxc6 4.d4 e5 5.dxe5 dxe5: white has given 2
  // checks; 6.Qxd8+ is the winning 3rd check.
  const moves = 'e2e4 d7d6 f1b5 c7c6 b5c6 b8c6 d2d4 e7e5 d4e5 d6e5';
  const viaMoves = await engineFen(`position startpos moves ${moves}`);
  check('check counter tracked through `moves`', / 1\+3 /.test(viaMoves), viaMoves);
  const mv3 = await bestmove(`position startpos moves ${moves}`, 'go depth 6');
  const afterPos = playStd(viaMoves.replace(/ \d\+\d /, ' '), mv3);
  check('plays the 3rd check after startpos+moves', !!afterPos && afterPos.isCheck(), mv3);

  // Game already over (white received 3 checks) -> engine reports "bestmove (none)"
  const over = await bestmove(`position fen ${board} 3+0 0 2`, 'go depth 3');
  console.log(`info  game-over position -> bestmove ${over}`);

  // Skill Level / movetime used by the app
  await send('setoption name Skill Level value 0');
  const weak = await bestmove('position startpos moves e2e4', 'go movetime 100 depth 1');
  check('Skill Level 0 search returns a move', !!weak && weak !== '(none)', weak);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  sf.terminate();
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll engine smoke checks passed');
process.exit(failed ? 1 : 0);
