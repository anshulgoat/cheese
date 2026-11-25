// Pure Three-Check rules layer on top of chessops.
import { ThreeCheck } from 'chessops/variant';
import { makeFen, parseFen, INITIAL_FEN } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { chessgroundDests } from 'chessops/compat';
import { normalizeMove } from 'chessops/chess';
import { parseSquare, parseUci, makeSquare } from 'chessops/util';
import type { NormalMove, Role, SquareName } from 'chessops/types';
import type { Color, GameState, MoveRecord, Outcome } from './types';

/** Starting FEN for three-check (chessops format: remaining checks "3+3"). */
export const START_FEN = makeFen(ThreeCheck.default().toSetup());

export function opposite(c: Color): Color {
  return c === 'white' ? 'black' : 'white';
}

/** Build a chessops ThreeCheck position from a FEN (standard or three-check FEN). */
export function positionFromFen(fen: string): ThreeCheck {
  return ThreeCheck.fromSetup(parseFen(fen).unwrap()).unwrap();
}

/** Repetition key: board, turn, castling, legal ep square, check counts — no clocks. */
function positionKey(pos: ThreeCheck): string {
  return makeFen(pos.toSetup(), { epd: true });
}

function checksGivenOf(pos: ThreeCheck): Record<Color, number> {
  const rc = pos.remainingChecks!;
  return { white: 3 - rc.white, black: 3 - rc.black };
}

/** Outcome for `pos`, given all position keys seen so far (including the current one). */
function detectOutcome(pos: ThreeCheck, keys: string[]): Outcome | null {
  const variant = pos.variantOutcome();
  if (variant?.winner) return { winner: variant.winner, reason: 'three-check' };
  const ctx = pos.ctx();
  if (pos.isCheckmate(ctx)) return { winner: opposite(pos.turn), reason: 'checkmate' };
  if (pos.isStalemate(ctx)) return { winner: null, reason: 'stalemate' };
  if (pos.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' };
  const current = keys[keys.length - 1];
  if (keys.filter(k => k === current).length >= 3) return { winner: null, reason: 'repetition' };
  if (pos.halfmoves >= 100) return { winner: null, reason: 'fifty-move' };
  return null;
}

function stateFrom(pos: ThreeCheck, history: MoveRecord[], startFen: string, keys: string[]): GameState {
  return {
    fen: makeFen(pos.toSetup()),
    turn: pos.turn,
    history,
    checksGiven: checksGivenOf(pos),
    inCheck: pos.isCheck(),
    outcome: detectOutcome(pos, keys),
    startFen,
  };
}

function allKeys(state: GameState): string[] {
  const start = state.startFen ?? START_FEN;
  return [start, ...state.history.map(h => h.fen)].map(f => positionKey(positionFromFen(f)));
}

/** New game from the standard start position (or a custom FEN, useful for tests/puzzles). */
export function newGame(fen: string = START_FEN): GameState {
  const pos = positionFromFen(fen);
  const startFen = makeFen(pos.toSetup());
  return stateFrom(pos, [], startFen, [positionKey(pos)]);
}

/** Legal destinations in chessground format. Empty when the game is over. */
export function legalDests(state: GameState): Map<SquareName, SquareName[]> {
  if (state.outcome) return new Map();
  return chessgroundDests(positionFromFen(state.fen));
}

/** True if moving from→to is a pawn reaching the last rank (UI must ask for a piece). */
export function needsPromotion(state: GameState, from: string, to: string): boolean {
  const f = parseSquare(from);
  const t = parseSquare(to);
  if (f === undefined || t === undefined) return false;
  const pos = positionFromFen(state.fen);
  const piece = pos.board.get(f);
  if (!piece || piece.role !== 'pawn' || piece.color !== pos.turn) return false;
  const rank = t >> 3;
  return (piece.color === 'white' && rank === 7) || (piece.color === 'black' && rank === 0);
}

/**
 * Validate a UCI move. Accepts castling either as king-two-squares (e1g1) or
 * king-takes-rook (e1h1). Returns the chessops move (normalized for play) and
 * the canonical standard UCI (e1g1 style) or null if illegal.
 */
function resolveMove(pos: ThreeCheck, uci: string): { move: NormalMove; uci: string } | null {
  const parsed = parseUci(uci);
  if (!parsed || !('from' in parsed)) return null;
  const move = normalizeMove(pos, parsed) as NormalMove;
  if (!pos.isLegal(move)) return null;
  let canonical = uci.slice(0, 4) + (parsed.promotion ? uci.slice(4, 5).toLowerCase() : '');
  const king = pos.board.kingOf(pos.turn);
  if (king === move.from && pos.board[pos.turn].has(move.to)) {
    // Castling expressed as king→rook: convert to king two squares.
    const rank = move.from & ~7;
    const toFile = move.to > move.from ? 6 : 2;
    canonical = makeSquare(move.from) + makeSquare(rank + toFile);
  }
  return { move, uci: canonical };
}

export function isLegalMove(state: GameState, uci: string): boolean {
  if (state.outcome) return false;
  return resolveMove(positionFromFen(state.fen), uci) !== null;
}

/** Play a UCI move and return the new state. Throws on an illegal move or finished game. */
export function play(state: GameState, uci: string): GameState {
  if (state.outcome) throw new Error('Game is over');
  const pos = positionFromFen(state.fen);
  const resolved = resolveMove(pos, uci);
  if (!resolved) throw new Error(`Illegal move: ${uci}`);
  const san = makeSan(pos, resolved.move);
  pos.play(resolved.move);
  const record: MoveRecord = { uci: resolved.uci, san, fen: makeFen(pos.toSetup()) };
  const history = [...state.history, record];
  const keys = [...allKeys(state), positionKey(pos)];
  return stateFrom(pos, history, state.startFen ?? START_FEN, keys);
}

/** Replay a list of UCI moves from a start FEN. */
export function replay(uciMoves: string[], startFen: string = START_FEN): GameState {
  let s = newGame(startFen);
  for (const m of uciMoves) s = play(s, m);
  return s;
}

/** State after only the first `n` moves (used for undo). */
export function truncate(state: GameState, n: number): GameState {
  return replay(
    state.history.slice(0, Math.max(0, n)).map(h => h.uci),
    state.startFen ?? START_FEN,
  );
}

export function resign(state: GameState, loser: Color): GameState {
  if (state.outcome) return state;
  return { ...state, outcome: { winner: opposite(loser), reason: 'resign' } };
}

/** Which color made history[index]. */
export function moverOf(state: GameState, index: number): Color {
  const startTurn: Color = (state.startFen ?? START_FEN).split(' ')[1] === 'b' ? 'black' : 'white';
  return index % 2 === 0 ? startTurn : opposite(startTurn);
}

/** Last move as [from, to] squares for highlighting. */
export function lastMoveSquares(state: GameState): [SquareName, SquareName] | undefined {
  const last = state.history[state.history.length - 1];
  if (!last) return undefined;
  return [last.uci.slice(0, 2) as SquareName, last.uci.slice(2, 4) as SquareName];
}

export const PROMOTION_ROLES: Role[] = ['queen', 'knight', 'rook', 'bishop'];
export const ROLE_CHAR: Record<string, string> = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' };

export function describeOutcome(o: Outcome): string {
  if (o.winner) {
    const w = o.winner === 'white' ? 'White' : 'Black';
    const by: Record<string, string> = {
      'three-check': 'three checks',
      checkmate: 'checkmate',
      resign: 'resignation',
    };
    return `${w} wins by ${by[o.reason] ?? o.reason}`;
  }
  const draw: Record<string, string> = {
    stalemate: 'Draw by stalemate',
    repetition: 'Draw by repetition',
    'fifty-move': 'Draw by fifty-move rule',
    insufficient: 'Draw by insufficient material',
  };
  return draw[o.reason] ?? 'Draw';
}

export { INITIAL_FEN };
