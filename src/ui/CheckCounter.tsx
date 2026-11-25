import type { Color } from '../game/types';

interface Props {
  color: Color;
  label: string;
  checks: number;
  active: boolean;
  /** Small "thinking" indicator next to the name. */
  thinking?: boolean;
}

export function CheckCounter({ color, label, checks, active, thinking }: Props) {
  const danger = checks === 2;
  return (
    <div className={`player-strip ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}>
      <div className="player-name">
        <span className={`color-dot ${color}`} aria-hidden />
        <span>{label}</span>
        {thinking && <span className="thinking-dots" aria-label="thinking"><i /><i /><i /></span>}
      </div>
      <div className="checks" aria-label={`${label} has given ${checks} of 3 checks`}>
        <span className="checks-label">{danger ? 'one more wins' : 'checks'}</span>
        {[0, 1, 2].map(i => (
          <span key={i} className={`pip ${i < checks ? 'filled' : ''}`}>
            <span className="pip-plus">+</span>
          </span>
        ))}
      </div>
    </div>
  );
}
