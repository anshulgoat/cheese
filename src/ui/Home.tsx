import { useState } from 'react';
import type { Color, EngineLevel, Mode } from '../game/types';

export type ColorChoice = Color | 'random';

export interface HomeChoices {
  mode: Mode;
  colorChoice: ColorChoice;
  level: EngineLevel;
  autoFlip: boolean;
}

interface Props {
  initial: HomeChoices;
  onStart: (choices: HomeChoices) => void;
}

const LEVELS: EngineLevel[] = [1, 2, 3, 4, 5, 6, 7, 8];
const LEVEL_HINT: Record<EngineLevel, string> = {
  1: 'Beginner',
  2: 'Casual',
  3: 'Club',
  4: 'Intermediate',
  5: 'Strong',
  6: 'Expert',
  7: 'Master',
  8: 'Maximum',
};

export function Home({ initial, onStart }: Props) {
  const [c, setC] = useState<HomeChoices>(initial);
  const set = <K extends keyof HomeChoices>(k: K, v: HomeChoices[K]) => setC(prev => ({ ...prev, [k]: v }));

  return (
    <main className="home">
      <header className="home-hero">
        <div className="logo" aria-hidden>
          <span>+</span>
          <span>+</span>
          <span>+</span>
        </div>
        <h1>Three-Check Chess</h1>
        <p className="tagline">Regular chess — but the third check wins.</p>
      </header>

      <section className="card rules">
        <h2>How it works</h2>
        <ul>
          <li>All normal chess rules apply: checkmate, stalemate, repetition and the 50-move rule.</li>
          <li>
            Every time you put the enemy king <strong>in check</strong>, you score a point.
          </li>
          <li>
            Deliver your <strong>3rd check</strong> and you win immediately — even if it isn&apos;t mate.
          </li>
        </ul>
      </section>

      <section className="card setup">
        <div className="segmented" role="tablist" aria-label="Game mode">
          <button role="tab" aria-selected={c.mode === 'otb'} className={c.mode === 'otb' ? 'on' : ''} onClick={() => set('mode', 'otb')}>
            Two players
            <small>one device</small>
          </button>
          <button role="tab" aria-selected={c.mode === 'ai'} className={c.mode === 'ai' ? 'on' : ''} onClick={() => set('mode', 'ai')}>
            vs Computer
            <small>Fairy-Stockfish</small>
          </button>
        </div>

        {c.mode === 'ai' ? (
          <>
            <div className="field">
              <label>Play as</label>
              <div className="chips">
                {(['white', 'random', 'black'] as ColorChoice[]).map(col => (
                  <button key={col} className={`chip ${c.colorChoice === col ? 'on' : ''}`} onClick={() => set('colorChoice', col)}>
                    <span className={`color-dot ${col}`} aria-hidden />
                    {col[0].toUpperCase() + col.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>
                Strength <span className="muted">· level {c.level} — {LEVEL_HINT[c.level]}</span>
              </label>
              <div className="levels">
                {LEVELS.map(l => (
                  <button key={l} className={`level ${c.level === l ? 'on' : ''}`} onClick={() => set('level', l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <label className="toggle">
              <input type="checkbox" checked={c.autoFlip} onChange={e => set('autoFlip', e.target.checked)} />
              <span className="switch" aria-hidden />
              <span>
                Auto-flip board
                <small className="muted"> — turn the board toward the player to move</small>
              </span>
            </label>
          </div>
        )}

        <button className="btn primary big" onClick={() => onStart(c)}>
          Start game
        </button>
      </section>
    </main>
  );
}
