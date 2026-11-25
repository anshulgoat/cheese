// Contract for the Fairy-Stockfish engine wrapper (implemented by the engine agent).
import type { EngineLevel } from '../game/types';

export interface EngineClient {
  /** Load WASM, run `uci`, set `UCI_Variant 3check`, wait for `readyok`. */
  init(): Promise<void>;
  setLevel(level: EngineLevel): void;
  /** Position = startpos + these UCI moves. Resolves to a UCI move like "e7e8q". */
  bestMove(uciMoves: string[]): Promise<string>;
  /** Abort the current search (pending bestMove should reject or resolve and be ignored). */
  stop(): void;
  terminate(): void;
}

/** Factory — the engine agent replaces this stub with the real implementation. */
export function createEngine(): EngineClient {
  throw new Error('Engine not implemented yet');
}
