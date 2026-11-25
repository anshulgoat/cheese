import { useEffect, useRef } from 'react';
import type { MoveRecord } from '../game/types';

interface Props {
  history: MoveRecord[];
  /** True if the first recorded move was made by black (custom start positions). */
  blackFirst?: boolean;
  /** Index into history of the highlighted move (-1 = start position). */
  current: number;
  onSelect: (index: number) => void;
  /** Rendered after the last row (result block). */
  footer?: React.ReactNode;
}

export function MoveList({ history, blackFirst = false, current, onSelect, footer }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>('.move.active');
    if (el && active) el.scrollTop = active.offsetTop - el.clientHeight / 2;
    else if (el) el.scrollTop = el.scrollHeight;
  }, [current, history.length, footer]);

  const idx: (number | null)[] = history.map((_, i) => i);
  if (blackFirst) idx.unshift(null);
  const rows: { n: number; w: number | null; b: number | null }[] = [];
  for (let i = 0; i < idx.length; i += 2) rows.push({ n: i / 2 + 1, w: idx[i], b: idx[i + 1] ?? null });

  const cell = (i: number | null, key: string) =>
    i === null ? (
      <span key={key} className="move empty">
        …
      </span>
    ) : (
      <button key={key} className={`move ${i === current ? 'active' : ''}`} onClick={() => onSelect(i)}>
        {history[i].san}
      </button>
    );

  return (
    <div className="rmoves" ref={ref}>
      {rows.length === 0 && !footer && <div className="moves-empty">Your move — good luck!</div>}
      <div className="moves-table">
        {rows.map(r => [
          <span key={`n${r.n}`} className="index">
            {r.n}
          </span>,
          cell(r.w, `w${r.n}`),
          r.b === null ? <span key={`b${r.n}`} className="move empty" /> : cell(r.b, `b${r.n}`),
        ])}
      </div>
      {footer}
    </div>
  );
}
