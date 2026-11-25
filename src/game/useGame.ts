import { useCallback, useEffect, useRef, useState } from 'react';
import { createEngine, isEngineAbort, type EngineClient } from '../engine/EngineClient';
import { isLegalMove, moverOf, newGame as rulesNewGame, opposite, play, resign as rulesResign, truncate } from './rules';
import type { Color, GameSettings, GameState } from './types';

export interface UseGame {
  state: GameState;
  settings: GameSettings;
  /** Board orientation (bottom side). */
  orientation: Color;
  /** AI is computing a move. */
  thinking: boolean;
  /** Friendly engine error message (AI mode), or null. */
  engineError: string | null;
  /** True when the human may move now (OTB: always while game running). */
  canMove: boolean;
  canUndo: boolean;
  /** Play a UCI move for the side to move (ignored if illegal / not allowed). Returns success. */
  move: (uci: string) => boolean;
  undo: () => void;
  resign: () => void;
  newGame: (settings?: GameSettings) => void;
  flip: () => void;
  /** Re-attempt engine init / move after an engine error. */
  retryEngine: () => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'otb',
  playerColor: 'white',
  level: 4,
  autoFlip: false,
};

export function useGame(initialSettings: GameSettings = DEFAULT_SETTINGS): UseGame {
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [state, setState] = useState<GameState>(() => rulesNewGame());
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const engineRef = useRef<EngineClient | null>(null);
  const initRef = useRef<Promise<EngineClient> | null>(null);
  const requestIdRef = useRef(0);
  const searchingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  /** Lazily create + init the engine once. A failed init is cleared so it can be retried. */
  const getEngine = useCallback((): Promise<EngineClient> => {
    if (!initRef.current) {
      let engine: EngineClient | null = null;
      const p: Promise<EngineClient> = (async () => {
        engine = createEngine(); // may throw synchronously → rejected promise
        engineRef.current = engine;
        await engine.init();
        return engine;
      })();
      initRef.current = p;
      p.catch(() => {
        try {
          engine?.terminate();
        } catch {
          /* ignore */
        }
        // Only clear if a newer engine hasn't replaced this one.
        if (initRef.current === p) initRef.current = null;
        if (engineRef.current === engine) engineRef.current = null;
      });
    }
    return initRef.current;
  }, []);

  const stopSearch = useCallback(() => {
    requestIdRef.current++;
    if (searchingRef.current) {
      searchingRef.current = false;
      try {
        engineRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Terminate the engine on unmount.
  useEffect(
    () => () => {
      try {
        engineRef.current?.terminate();
      } catch {
        /* ignore */
      }
      engineRef.current = null;
      initRef.current = null;
    },
    [],
  );

  const aiTurn = settings.mode === 'ai' && !state.outcome && state.turn !== settings.playerColor;

  // Ask the engine for a move whenever it is the AI's turn.
  useEffect(() => {
    if (!aiTurn) return;
    const id = ++requestIdRef.current;
    const moves = state.history.map(h => h.uci);
    const level = settings.level;
    setThinking(true);
    setEngineError(null);

    getEngine()
      .then(engine => {
        if (id !== requestIdRef.current) return null;
        engine.setLevel(level);
        searchingRef.current = true;
        return engine.bestMove(moves);
      })
      .then(uci => {
        if (uci === null || id !== requestIdRef.current) return;
        searchingRef.current = false;
        setThinking(false);
        // Any change to the position bumps the request id, so stateRef matches `moves`.
        const current = stateRef.current;
        if (!isLegalMove(current, uci)) {
          setEngineError(`The engine returned an invalid move (${uci}).`);
          return;
        }
        setState(play(current, uci));
      })
      .catch((err: unknown) => {
        if (id !== requestIdRef.current) return;
        searchingRef.current = false;
        setThinking(false);
        if (isEngineAbort(err)) return;
        console.error('Engine error', err);
        setEngineError(
          'The chess engine could not be loaded or failed to move. ' +
            'You can retry, or play over the board instead.',
        );
      });

    return () => {
      stopSearch();
      setThinking(false);
    };
    // state.history identity changes on every move; retryNonce forces a retry.
  }, [aiTurn, state.history, settings.level, getEngine, stopSearch, retryNonce]);

  const humanColor: Color | null = settings.mode === 'ai' ? settings.playerColor : null;
  const canMove = !state.outcome && (humanColor === null || state.turn === humanColor);

  const move = useCallback(
    (uci: string): boolean => {
      if (!canMove || !isLegalMove(state, uci)) return false;
      setState(play(state, uci));
      return true;
    },
    [canMove, state],
  );

  // AI mode: undo back to the most recent position where it is the human's turn,
  // removing at least one human move. OTB: undo one ply.
  const undoTarget = (() => {
    const n = state.history.length;
    if (n === 0) return null;
    if (humanColor === null) return n - 1;
    for (let i = n - 1; i >= 0; i--) {
      if (moverOf(state, i) === humanColor) return i; // position before human's move i
    }
    return null;
  })();
  const canUndo = undoTarget !== null;

  const undo = useCallback(() => {
    if (undoTarget === null) return;
    stopSearch();
    setThinking(false);
    setEngineError(null);
    setState(truncate(state, undoTarget));
  }, [undoTarget, state, stopSearch]);

  const resign = useCallback(() => {
    if (state.outcome) return;
    stopSearch();
    setThinking(false);
    setState(rulesResign(state, humanColor ?? state.turn));
  }, [state, humanColor, stopSearch]);

  const newGame = useCallback(
    (next?: GameSettings) => {
      stopSearch();
      setThinking(false);
      setEngineError(null);
      setFlipped(false);
      if (next) setSettings(next);
      setState(rulesNewGame());
    },
    [stopSearch],
  );

  const flip = useCallback(() => setFlipped(f => !f), []);
  const retryEngine = useCallback(() => {
    setEngineError(null);
    setRetryNonce(n => n + 1);
  }, []);

  let base: Color;
  if (settings.mode === 'ai') base = settings.playerColor;
  else if (settings.autoFlip) base = state.turn;
  else base = 'white';
  const orientation = flipped ? opposite(base) : base;

  return {
    state,
    settings,
    orientation,
    thinking,
    engineError,
    canMove,
    canUndo,
    move,
    undo,
    resign,
    newGame,
    flip,
    retryEngine,
  };
}
