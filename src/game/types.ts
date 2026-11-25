// Shared contract between the rules/UI layer and the engine layer.
export type Color = 'white' | 'black';
export type Mode = 'otb' | 'ai';

/** 1 (weakest) … 8 (strongest) */
export type EngineLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type OutcomeReason =
  | 'three-check'
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'fifty-move'
  | 'insufficient'
  | 'resign';

export interface Outcome {
  winner: Color | null; // null = draw
  reason: OutcomeReason;
}

export interface MoveRecord {
  uci: string; // e.g. "e2e4", "e7e8q"
  san: string; // e.g. "e4", "Qxf7+"
  fen: string; // FEN after the move (three-check FEN incl. check counts)
}

export interface GameState {
  fen: string;
  turn: Color;
  history: MoveRecord[];
  /** Number of checks each side has GIVEN (0–3). */
  checksGiven: Record<Color, number>;
  inCheck: boolean;
  outcome: Outcome | null;
  /** FEN the game started from (added by rules layer; defaults to the standard start). */
  startFen?: string;
}

export interface GameSettings {
  mode: Mode;
  /** AI mode only: the human's color. */
  playerColor: Color;
  level: EngineLevel;
  /** OTB only: flip board after each move. */
  autoFlip: boolean;
}
