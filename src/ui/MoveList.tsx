import { useEffect, useRef } from 'react';
import type { MoveRecord } from '../game/types';

interface Props {
  history: MoveRecord[];
  /** True if the first recorded move was made by black (custom start positions). */
  blackFirst?: boolean;
}

export function MoveList({ history, blackFirst = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  const sans: (string | null)[] = history.map(h => h.san);
  if (blackFirst) sans.unshift(null);
  const rows: { n: number; w: string | null; b: string | null; wi: number; bi: number }[] = [];
  for (let i = 0; i < sans.length; i += 2) {
    const off = blackFirst ? 1 : 0;
    rows.push({ n: i / 2 + 1, w: sans[i], b: sans[i + 1] ?? null, wi: i - off, bi: i + 1 - off });
  }
  const last = history.length - 1;

  return (
    <div className="move-list" ref={ref}>
      {rows.length === 0 && <div className="move-empty">No moves yet</div>}
      {rows.map(r => (
        <div className="move-row" key={r.n}>
          <span className="move-no">{r.n}.</span>
          <span className={`move ${r.wi === last ? 'last' : ''}`}>{r.w ?? '…'}</span>
          <span className={`move ${r.bi === last ? 'last' : ''}`}>{r.b ?? ''}</span>
        </div>
      ))}
    </div>
  );
}
