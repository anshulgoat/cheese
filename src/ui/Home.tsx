import { useEffect, useState } from 'react';
import 'chessground/assets/chessground.cburnett.css';
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
  2: 'Novice',
  3: 'Casual',
  4: 'Club',
  5: 'Strong club',
  6: 'Expert',
  7: 'Master',
  8: 'Maximum',
};

const COLOR_CHOICES: { value: ColorChoice; label: string }[] = [
  { value: 'black', label: 'Black' },
  { value: 'random', label: 'Random side' },
  { value: 'white', label: 'White' },
];

export function Home({ initial, onStart }: Props) {
  const [c, setC] = useState<HomeChoices>(initial);
  const [dialog, setDialog] = useState<Mode | null>(null);
  const set = <K extends keyof HomeChoices>(k: K, v: HomeChoices[K]) => setC(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDialog(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  const quickPlay = (level: EngineLevel) => onStart({ ...c, mode: 'ai', level });

  return (
    <main className="lobby">
      <aside className="lobby-side box">
        <h2 className="box-title">Three-check</h2>
        <p>All normal chess rules apply — checkmate, stalemate, repetition and the 50-move rule.</p>
        <p>
          Every time you put the enemy king <strong>in check</strong> you score one.{' '}
          <strong>Give three checks and you win</strong>, even without mate.
        </p>
        <div className="lobby-pips" aria-hidden>
          <span className="pip filled">+</span>
          <span className="pip filled">+</span>
          <span className="pip filled">+</span>
        </div>
      </aside>

      <section className="lobby-app">
        <div className="lobby-tabs">
          <span className="on">Quick play</span>
          <span className="muted">vs computer · {c.colorChoice === 'random' ? 'random side' : `as ${c.colorChoice}`}</span>
        </div>
        <div className="pool-grid">
          {LEVELS.map(l => (
            <button key={l} className="pool" onClick={() => quickPlay(l)}>
              <span className="pool-main">Level {l}</span>
              <span className="pool-sub">{LEVEL_HINT[l]}</span>
            </button>
          ))}
          <button className="pool custom" onClick={() => setDialog('ai')}>
            <span className="pool-main">Custom</span>
            <span className="pool-sub">Pick side &amp; level</span>
          </button>
        </div>
      </section>

      <div className="lobby-start">
        <button className="lobby-button" onClick={() => setDialog('otb')}>
          Play over the board
          <small>Two players, one device</small>
        </button>
        <button className="lobby-button" onClick={() => setDialog('ai')}>
          Play with the computer
          <small>Fairy-Stockfish</small>
        </button>
      </div>

      {dialog && (
        <div className="dialog-overlay" onClick={() => setDialog(null)}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <button className="dialog-close" onClick={() => setDialog(null)} aria-label="Close">
              ×
            </button>
            {dialog === 'ai' ? (
              <>
                <h2>Play with the computer</h2>
                <div className="dialog-variant">
                  Variant <b>Three-check</b>
                </div>
                <div className="dialog-field">
                  <div className="dialog-label">
                    Strength · <b>{LEVEL_HINT[c.level]}</b>
                  </div>
                  <div className="radio-group" role="radiogroup" aria-label="Strength">
                    {LEVELS.map(l => (
                      <button
                        key={l}
                        role="radio"
                        aria-checked={c.level === l}
                        className={c.level === l ? 'on' : ''}
                        onClick={() => set('level', l)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="color-submits">
                  {COLOR_CHOICES.map(({ value, label }) => (
                    <button
                      key={value}
                      className={`color-submit ${value} ${c.colorChoice === value ? 'last' : ''}`}
                      title={label}
                      aria-label={`Play as ${label}`}
                      onClick={() => onStart({ ...c, mode: 'ai', colorChoice: value })}
                    >
                      <span className="cg-wrap" aria-hidden>
                        {value !== 'black' && <piece className="king white" />}
                        {value !== 'white' && <piece className="king black" />}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2>Play over the board</h2>
                <div className="dialog-variant">
                  Variant <b>Three-check</b>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={c.autoFlip} onChange={e => set('autoFlip', e.target.checked)} />
                  <span className="switch" aria-hidden />
                  <span>Auto-flip board after each move</span>
                </label>
                <button className="button wide" onClick={() => onStart({ ...c, mode: 'otb' })}>
                  Start game
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
