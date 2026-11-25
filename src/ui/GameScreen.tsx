import { useCallback, useMemo, useState } from 'react';
import { describeOutcome, lastMoveSquares, legalDests, moverOf, needsPromotion, opposite } from '../game/rules';
import type { Color, GameSettings } from '../game/types';
import { useGame } from '../game/useGame';
import { Board } from './Board';
import { CheckCounter } from './CheckCounter';
import { MoveList } from './MoveList';
import { PromotionPicker } from './PromotionPicker';

interface Props {
  settings: GameSettings;
  /** Settings for a rematch (e.g. re-rolls a random color). */
  rematchSettings: () => GameSettings;
  onMenu: () => void;
}

const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');

export function GameScreen({ settings: initialSettings, rematchSettings, onMenu }: Props) {
  const game = useGame(initialSettings);
  const { state, settings, orientation, thinking, engineError } = game;
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const [modalDismissed, setModalDismissed] = useState(false);

  const dests = useMemo(() => (game.canMove ? legalDests(state) : new Map<string, string[]>()), [state, game.canMove]);
  const lastMove = lastMoveSquares(state);

  const onMove = useCallback(
    (from: string, to: string) => {
      if (needsPromotion(state, from, to)) {
        setPromo({ from, to });
        return;
      }
      if (!game.move(from + to)) setSyncKey(k => k + 1);
    },
    [state, game],
  );

  const ai = settings.mode === 'ai';
  const human = settings.playerColor;
  const labelFor = (c: Color) => (ai ? (c === human ? 'You' : `Computer · L${settings.level}`) : cap(c));
  const top = opposite(orientation);
  const bottom = orientation;

  let status: string;
  if (state.outcome) status = describeOutcome(state.outcome);
  else if (ai && thinking) status = 'Computer is thinking…';
  else if (ai) status = state.turn === human ? (state.inCheck ? 'You are in check!' : 'Your move') : 'Computer to move';
  else status = `${cap(state.turn)} to move${state.inCheck ? ' — check!' : ''}`;

  const newGame = () => {
    setPromo(null);
    setModalDismissed(false);
    game.newGame(rematchSettings());
  };

  const undo = () => {
    setPromo(null);
    setModalDismissed(false);
    game.undo();
  };

  const resultTitle = (() => {
    const o = state.outcome;
    if (!o) return '';
    if (!o.winner) return 'Draw';
    if (ai) return o.winner === human ? 'You win!' : 'You lose';
    return `${cap(o.winner)} wins`;
  })();

  const firstMover = moverOf(state, 0);

  return (
    <main className="game">
      <div className="board-col">
        <CheckCounter
          color={top}
          label={labelFor(top)}
          checks={state.checksGiven[top]}
          active={!state.outcome && state.turn === top}
          thinking={thinking && ai && top !== human}
        />
        <div className="board-wrap">
          <Board
            fen={state.fen}
            orientation={orientation}
            turnColor={state.turn}
            movableColor={game.canMove && !promo ? state.turn : undefined}
            dests={dests}
            lastMove={lastMove}
            check={state.inCheck ? state.turn : false}
            onMove={onMove}
            syncKey={syncKey}
          />
          {promo && (
            <PromotionPicker
              color={state.turn}
              onPick={p => {
                const { from, to } = promo;
                setPromo(null);
                if (!game.move(from + to + p)) setSyncKey(k => k + 1);
              }}
              onCancel={() => {
                setPromo(null);
                setSyncKey(k => k + 1);
              }}
            />
          )}
        </div>
        <CheckCounter
          color={bottom}
          label={labelFor(bottom)}
          checks={state.checksGiven[bottom]}
          active={!state.outcome && state.turn === bottom}
          thinking={thinking && ai && bottom !== human}
        />
      </div>

      <aside className="side-col">
        <div className={`status ${state.outcome ? 'over' : ''} ${state.inCheck && !state.outcome ? 'in-check' : ''}`} role="status" aria-live="polite">
          {thinking && <span className="spinner" aria-hidden />}
          {status}
        </div>
        {engineError && ai && (
          <div className="engine-error" role="alert">
            <p>{engineError}</p>
            <div className="row">
              <button className="btn small" onClick={game.retryEngine}>Retry</button>
              <button className="btn small ghost" onClick={onMenu}>Back to menu</button>
            </div>
          </div>
        )}

        <div className="controls">
          <button className="btn" onClick={undo} disabled={!game.canUndo} title="Take back">
            ↶ Undo
          </button>
          <button className="btn" onClick={game.flip} title="Flip board">
            ⇅ Flip
          </button>
          <button className="btn danger" onClick={game.resign} disabled={!!state.outcome} title="Resign">
            ⚑ Resign
          </button>
          <button className="btn" onClick={newGame} title="New game">
            ＋ New
          </button>
        </div>

        <MoveList history={state.history} blackFirst={firstMover === 'black'} />

        <button className="btn ghost menu-btn" onClick={onMenu}>
          ← Menu
        </button>
      </aside>

      {state.outcome && !modalDismissed && (
        <div className="modal-overlay" onClick={() => setModalDismissed(true)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className={`modal-badge ${state.outcome.reason}`}>
              {state.outcome.reason === 'three-check' ? '+++' : state.outcome.winner ? '♚' : '½'}
            </div>
            <h2>{resultTitle}</h2>
            <p>{describeOutcome(state.outcome)}</p>
            <p className="muted small">
              Checks — White {state.checksGiven.white}/3 · Black {state.checksGiven.black}/3
            </p>
            <div className="row">
              <button className="btn primary" onClick={newGame}>Play again</button>
              <button className="btn" onClick={() => setModalDismissed(true)}>View board</button>
              <button className="btn ghost" onClick={onMenu}>Menu</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
