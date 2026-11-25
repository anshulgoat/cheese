import type { Color } from '../game/types';

interface Props {
  color: Color;
  label: string;
  checks: number;
  active: boolean;
  /** Small "thinking" indicator next to the name. */
  thinking?: boolean;
  /** Extra class, e.g. top/bottom placement. */
  className?: string;
}

/** Player name + a clock-style box showing checks given (lichess round layout). */
export function CheckCounter({ color, label, checks, active, thinking, className = '' }: Props) {
  const danger = checks === 2;
  return (
    <div className={`rplayer ${className}`}>
      <div className="ruser">
        <span className={`ruser-dot ${color}`} aria-hidden />
        <span className="ruser-name">{label}</span>
        {thinking && <span className="spinner" aria-label="thinking" />}
      </div>
      <div
        className={`rchecks ${active ? 'running' : ''} ${danger ? 'danger' : ''}`}
        aria-label={`${label} has given ${checks} of 3 checks`}
      >
        {[0, 1, 2].map(i => (
          <span key={i} className={`pip ${i < checks ? 'filled' : ''}`}>
            +
          </span>
        ))}
        <span className="rchecks-count">{checks}/3</span>
      </div>
    </div>
  );
}
