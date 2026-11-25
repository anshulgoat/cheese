import { useCallback, useState } from 'react';
import type { GameSettings } from './game/types';
import { GameScreen } from './ui/GameScreen';
import { Home, type HomeChoices } from './ui/Home';

const STORAGE_KEY = 'three-check:home';
const DEFAULT_CHOICES: HomeChoices = { mode: 'otb', colorChoice: 'random', level: 3, autoFlip: false };

function loadChoices(): HomeChoices {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CHOICES, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_CHOICES;
}

function toSettings(c: HomeChoices): GameSettings {
  const playerColor =
    c.colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : c.colorChoice;
  return { mode: c.mode, playerColor, level: c.level, autoFlip: c.autoFlip };
}

export default function App() {
  const [choices, setChoices] = useState<HomeChoices>(loadChoices);
  const [game, setGame] = useState<{ key: number; settings: GameSettings } | null>(null);

  const start = (c: HomeChoices) => {
    setChoices(c);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
    setGame(g => ({ key: (g?.key ?? 0) + 1, settings: toSettings(c) }));
  };

  const rematch = useCallback(() => toSettings(choices), [choices]);
  const home = () => setGame(null);

  return (
    <div className="app">
      <header className="site-header">
        <button className="site-title" onClick={home} aria-label="Home">
          <span className="site-mark" aria-hidden>+3</span>
          three<b>check</b>
        </button>
        <nav className="site-nav">
          <button onClick={home} className={game ? '' : 'on'}>Play</button>
        </nav>
      </header>
      {game ? (
        <GameScreen key={game.key} settings={game.settings} rematchSettings={rematch} onMenu={home} />
      ) : (
        <Home initial={choices} onStart={start} />
      )}
    </div>
  );
}
