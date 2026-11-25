import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import type { Color } from '../game/types';

export interface BoardProps {
  fen: string;
  orientation: Color;
  turnColor: Color;
  /** Color allowed to move, or undefined to disable moving. */
  movableColor: Color | undefined;
  dests: Map<string, string[]>;
  lastMove?: [string, string];
  /** Side in check (highlight its king), or false. */
  check: Color | false;
  onMove: (from: string, to: string) => void;
  /** Bump to force the board to resync to `fen` (e.g. after a cancelled promotion). */
  syncKey?: number;
}

export function Board(props: BoardProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const onMoveRef = useRef(props.onMove);
  onMoveRef.current = props.onMove;

  const config: Config = {
    // chessground ignores extra FEN fields (check counts etc.)
    fen: props.fen,
    orientation: props.orientation,
    turnColor: props.turnColor,
    check: props.check,
    lastMove: props.lastMove as Key[] | undefined,
    movable: {
      free: false,
      color: props.movableColor,
      dests: props.dests as Map<Key, Key[]>,
      showDests: true,
    },
  };

  useEffect(() => {
    if (!elRef.current) return;
    const api = Chessground(elRef.current, {
      ...config,
      animation: { enabled: true, duration: 200 },
      highlight: { lastMove: true, check: true },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true },
      movable: {
        ...config.movable,
        events: { after: (orig, dest) => onMoveRef.current(orig, dest) },
      },
    });
    apiRef.current = api;
    // Keep chessground's cached geometry in sync with layout changes.
    const ro = new ResizeObserver(() => api.redrawAll());
    ro.observe(elRef.current);
    return () => {
      ro.disconnect();
      api.destroy();
      apiRef.current = null;
    };
    // create once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.set({ ...config, movable: { ...config.movable } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fen, props.orientation, props.turnColor, props.movableColor, props.dests, props.check, props.lastMove?.[0], props.lastMove?.[1], props.syncKey]);

  return <div ref={elRef} className="cg-board-host" />;
}
