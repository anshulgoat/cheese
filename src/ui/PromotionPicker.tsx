import type { Color } from '../game/types';

const ROLES = [
  ['queen', 'q'],
  ['knight', 'n'],
  ['rook', 'r'],
  ['bishop', 'b'],
] as const;

interface Props {
  color: Color;
  onPick: (promo: 'q' | 'n' | 'r' | 'b') => void;
  onCancel: () => void;
}

export function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div className="promo-overlay" onClick={onCancel} role="dialog" aria-label="Choose promotion piece">
      <div className="promo-box cg-wrap" onClick={e => e.stopPropagation()}>
        <div className="promo-title">Promote to</div>
        <div className="promo-choices">
          {ROLES.map(([role, ch]) => (
            <button key={role} className="promo-btn" onClick={() => onPick(ch)} title={role} aria-label={role}>
              <piece className={`${role} ${color}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Allow the custom <piece> element used by chessground's piece CSS.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      piece: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
