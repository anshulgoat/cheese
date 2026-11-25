import { useCallback, useEffect, useMemo, useState } from 'react';
import { describeOutcome, lastMoveSquares, legalDests, moverOf, needsPromotion, opposite, START_FEN } from '../game/rules';
import type { Color, GameSettings, Outcome } from '../game/types';
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

const LEVEL_HINT = ['', 'Beginner', 'Novice', 'Casual', 'Club', 'Strong club', 'Expert', 'Master', 'Maximum'];
const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');
const score = (o: Outcome) => (o.winner === 'white' ? '1-0' : o.winner === 'black' ? '0-1' : '½-½');
const fenTurn = (fen: string): Color => (fen.split(' ')[1] === 'b' ? 'black' : 'white');

export function GameScreen({ settings: initialSettings, rematchSettings, onMenu }: Props) {
  const game = useGame(initialSettings);
  const { state, settings, orientation, thinking, engineError } = game;
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  /** Ply being viewed (0 = start position), or null when following the live game. */
  const [viewPly, setViewPly] = useState<number | null>(null);

  const total = state.history.length;
  useEffect(() => setViewPly(null), [total]);
  const ply = viewPly === null || viewPly >= total ? total : Math.max(0, viewPly);
  const live = ply === total;

  const goTo = useCallback((p: number) => setViewPly(p >= total ? null : Math.max(0, p)), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') goTo(ply - 1);
      else if (e.key === 'ArrowRight') goTo(ply + 1);
      else if (e.key === 'ArrowUp' || e.key === 'Home') goTo(0);
      else if (e.key === 'ArrowDown' || e.key === 'End') goTo(total);
      else if (e.key === 'f') game.flip();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, ply, total, game]);

  const canMove = game.canMove && live;
  const dests = useMemo(() => (canMove ? legalDests(state) : new Map<string, string[]>()), [state, canMove]);

  // Position shown on the board (live or browsed).
  const startFen = state.startFen ?? START_FEN;
  const viewFen = live ? state.fen : ply === 0 ? startFen : state.history[ply - 1].fen;
  const viewTurn = live ? state.turn : fenTurn(viewFen);
  const viewLast: [string, string] | undefined = live
    ? lastMoveSquares(state)
    : ply > 0
      ? [state.history[ply - 1].uci.slice(0, 2), state.history[ply - 1].uci.slice(2, 4)]
      : undefined;
  const viewInCheck = live ? state.inCheck : ply > 0 && /[+#]$/.test(state.history[ply - 1].san);
  const checksAt = (c: Color) =>
    live
      ? state.checksGiven[c]
      : state.history.slice(0, ply).filter((h, i) => moverOf(state, i) === c && /[+#]$/.test(h.san)).length;

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
  const labelFor = (c: Color) => (ai ? (c === human ? 'You' : `Fairy-Stockfish level ${settings.level}`) : cap(c));
  const top = opposite(orientation);
  const bottom = orientation;

  let status: string;
  if (ai && thinking) status = 'Computer is thinking…';
  else if (ai) status = state.turn === human ? (state.inCheck ? 'You are in check!' : 'Your turn') : 'Waiting for opponent';
  else status = `${cap(state.turn)} to play${state.inCheck ? ' — check!' : ''}`;

  const newGame = () => {
    setPromo(null);
    game.newGame(rematchSettings());
  };
  const undo = () => {
    setPromo(null);
    game.undo();
  };

  const player = (c: Color, where: 'top' | 'bottom') => (
    <CheckCounter
      className={where}
      color={c}
      label={labelFor(c)}
      checks={checksAt(c)}
      active={!state.outcome && live && state.turn === c}
      thinking={thinking && ai && c !== human}
    />
  );

  const outcome = state.outcome;
  const resultBlock = outcome && (
    <div className="result-wrap">
      <p className="result">{score(outcome)}</p>
      <p className="status-text">{describeOutcome(outcome)}</p>
    </div>
  );

  return (
    <main className="round">
      <aside className="round-side box">
        <div className="game-meta">
          <span className="game-icon" aria-hidden>+3</span>
          <div>
            <div className="game-title">Three-check · Casual</div>
            <div className="muted">{ai ? `vs computer · ${LEVEL_HINT[settings.level]}` : 'Over the board'}</div>
          </div>
        </div>
        <div className="game-players">
          <div>
            <span className="ruser-dot white" /> {labelFor('white')}
          </div>
          <div>
            <span className="ruser-dot black" /> {labelFor('black')}
          </div>
        </div>
        <p className="muted small">First to give three checks wins. Checkmate still wins too.</p>
        {outcome && <p className="side-result">{describeOutcome(outcome)}</p>}
      </aside>

      <div className="round-board">
        {player(top, 'top')}
        <div className="board-wrap">
          <Board
            fen={viewFen}
            orientation={orientation}
            turnColor={viewTurn}
            movableColor={canMove && !promo ? state.turn : undefined}
            dests={dests}
            lastMove={viewLast}
            check={viewInCheck ? viewTurn : false}
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
        {player(bottom, 'bottom')}
      </div>

      <div className="round-tools">
        {player(top, 'top')}
        <div className="rpanel">
          <div className="rnav">
            <button onClick={game.flip} title="Flip board (f)" aria-label="Flip board">⇅</button>
            <button onClick={() => goTo(0)} disabled={ply === 0} title="First move" aria-label="First move">⏮</button>
            <button onClick={() => goTo(ply - 1)} disabled={ply === 0} title="Previous move" aria-label="Previous move">◀</button>
            <button onClick={() => goTo(ply + 1)} disabled={live} title="Next move" aria-label="Next move">▶</button>
            <button onClick={() => goTo(total)} disabled={live} title="Last move" aria-label="Last move">⏭</button>
          </div>
          <MoveList
            history={state.history}
            blackFirst={moverOf(state, 0) === 'black'}
            current={ply - 1}
            onSelect={i => goTo(i + 1)}
            footer={resultBlock}
          />
          {engineError && ai && (
            <div className="engine-error" role="alert">
              <p>{engineError}</p>
              <div className="row">
                <button className="button small" onClick={game.retryEngine}>Retry</button>
                <button className="button small ghost" onClick={onMenu}>Back to menu</button>
              </div>
            </div>
          )}
          {outcome ? (
            <div className="follow-up">
              <button className="button wide" onClick={newGame}>Rematch</button>
              <button className="button ghost wide" onClick={onMenu}>New opponent</button>
            </div>
          ) : (
            <>
              <div className={`rstatus ${state.inCheck ? 'in-check' : ''}`} role="status" aria-live="polite">
                {status}
              </div>
              <div className="ractions">
                <button onClick={undo} disabled={!game.canUndo} title="Takeback">
                  <span aria-hidden>↶</span> Takeback
                </button>
                <button onClick={game.resign} title="Resign">
                  <span aria-hidden>⚑</span> Resign
                </button>
                <button onClick={newGame} title="New game">
                  <span aria-hidden>↻</span> New
                </button>
              </div>
            </>
          )}
        </div>
        {player(bottom, 'bottom')}
      </div>
    </main>
  );
}
