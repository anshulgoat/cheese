import type { EngineLevel } from '../game/types';

export interface LevelSettings {
  /** Fairy-Stockfish `Skill Level` option, 0..20 (20 = full strength). */
  skill: number;
  /** `go movetime` in ms. */
  movetime: number;
  /** Optional `go depth` cap (combined with movetime; whichever hits first). */
  depth?: number;
  label: string;
}

const LEVELS: Record<EngineLevel, LevelSettings> = {
  1: { skill: 0, movetime: 100, depth: 1, label: 'Beginner' },
  2: { skill: 2, movetime: 150, depth: 2, label: 'Novice' },
  3: { skill: 5, movetime: 200, depth: 3, label: 'Casual' },
  4: { skill: 8, movetime: 300, depth: 5, label: 'Club' },
  5: { skill: 11, movetime: 500, depth: 8, label: 'Strong club' },
  6: { skill: 14, movetime: 800, depth: 12, label: 'Expert' },
  7: { skill: 17, movetime: 1200, label: 'Master' },
  8: { skill: 20, movetime: 1800, label: 'Maximum' },
};

export function levelSettings(level: EngineLevel): LevelSettings {
  return LEVELS[level] ?? LEVELS[4];
}

/** Human-readable label for the UI, e.g. "Level 3 · Casual". */
export function levelLabel(level: EngineLevel): string {
  return `Level ${level} · ${levelSettings(level).label}`;
}

/** UCI `go` command for a level. */
export function goCommand(level: EngineLevel): string {
  const s = levelSettings(level);
  return `go movetime ${s.movetime}` + (s.depth ? ` depth ${s.depth}` : '');
}
