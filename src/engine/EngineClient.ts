// Contract for the Fairy-Stockfish engine wrapper (implemented by the engine agent).
import type { EngineLevel } from '../game/types';
import { goCommand, levelSettings } from './difficulty';

export interface EngineClient {
  /** Load WASM, run `uci`, set `UCI_Variant 3check`, wait for `readyok`. */
  init(): Promise<void>;
  setLevel(level: EngineLevel): void;
  /** Position = startpos + these UCI moves. Resolves to a UCI move like "e7e8q". */
  bestMove(uciMoves: string[]): Promise<string>;
  /** Abort the current search (pending bestMove should reject or resolve and be ignored). */
  stop(): void;
  terminate(): void;
}

/**
 * Thrown (as a rejection) by bestMove() when the request was superseded by a
 * newer bestMove(), by stop(), or by terminate(). UI code should ignore it:
 *   catch (e) { if (isEngineAbort(e)) return; ... }
 */
export class EngineAbortError extends Error {
  constructor(message = 'Engine search aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

export function isEngineAbort(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

// ---------------------------------------------------------------------------
// Loading the Emscripten pthreads build (public/fairy-stockfish/stockfish.js)
// ---------------------------------------------------------------------------

interface StockfishInstance {
  postMessage(cmd: string): void;
  addMessageListener(fn: (line: string) => void): void;
  removeMessageListener(fn: (line: string) => void): void;
  terminate(): void;
}
type StockfishFactory = (opts?: Record<string, unknown>) => Promise<StockfishInstance>;

const ENGINE_DIR = 'fairy-stockfish/';
let factoryPromise: Promise<StockfishFactory> | null = null;

function engineBaseUrl(): string {
  return new URL(import.meta.env.BASE_URL + ENGINE_DIR, window.location.href).href;
}

/** Injects the classic <script> once; it defines a global `Stockfish` factory. */
function loadFactory(): Promise<StockfishFactory> {
  if (factoryPromise) return factoryPromise;
  factoryPromise = new Promise<StockfishFactory>((resolve, reject) => {
    const w = window as unknown as { Stockfish?: StockfishFactory };
    if (typeof w.Stockfish === 'function') return resolve(w.Stockfish);
    const script = document.createElement('script');
    script.src = engineBaseUrl() + 'stockfish.js';
    script.async = true;
    script.onload = () => {
      if (typeof w.Stockfish === 'function') resolve(w.Stockfish);
      else reject(new Error('stockfish.js loaded but did not define Stockfish()'));
    };
    script.onerror = () => reject(new Error(`Failed to load ${script.src}`));
    document.head.appendChild(script);
  });
  factoryPromise.catch(() => {
    factoryPromise = null; // allow retry
  });
  return factoryPromise;
}

// ---------------------------------------------------------------------------

interface PendingSearch {
  resolve: (move: string) => void;
  reject: (err: Error) => void;
  settled: boolean;
  timer: ReturnType<typeof setTimeout>;
}

class FairyStockfishClient implements EngineClient {
  private sf: StockfishInstance | null = null;
  private initPromise: Promise<void> | null = null;
  private level: EngineLevel = 4;
  private appliedSkill: number | null = null;
  private lastMoves: string[] | null = null;
  private disposed = false;

  /** Bumped by every bestMove/stop/terminate; stale queued requests abort. */
  private generation = 0;
  /** The `go` currently running inside the engine (until its `bestmove`). */
  private current: PendingSearch | null = null;
  private idleWaiters: Array<() => void> = [];
  private lineWaiters: Array<{ match: (l: string) => boolean; resolve: () => void }> = [];

  private onLine = (line: string) => {
    if (line.startsWith('bestmove')) {
      const search = this.current;
      this.current = null;
      if (search && !search.settled) {
        search.settled = true;
        clearTimeout(search.timer);
        const move = line.split(/\s+/)[1];
        if (!move || move === '(none)') {
          search.reject(new Error('Engine returned no move (game over?)'));
        } else {
          search.resolve(move);
        }
      }
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      waiters.forEach((w) => w());
      return;
    }
    for (const w of [...this.lineWaiters]) {
      if (w.match(line)) {
        this.lineWaiters.splice(this.lineWaiters.indexOf(w), 1);
        w.resolve();
      }
    }
  };

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit();
      this.initPromise.catch(() => {
        this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (this.disposed) throw new Error('Engine was terminated');
    if (typeof SharedArrayBuffer === 'undefined' || !globalThis.crossOriginIsolated) {
      throw new Error(
        'The chess engine needs SharedArrayBuffer, which requires a cross-origin isolated page. ' +
          'Serve the app with "Cross-Origin-Opener-Policy: same-origin" and ' +
          '"Cross-Origin-Embedder-Policy: require-corp" headers (over HTTPS or localhost).',
      );
    }
    if (typeof WebAssembly !== 'object') {
      throw new Error('This browser does not support WebAssembly.');
    }
    const factory = await loadFactory();
    const base = engineBaseUrl();
    const sf = await factory({
      locateFile: (path: string) => base + path,
      mainScriptUrlOrBlob: base + 'stockfish.js',
    });
    if (this.disposed) {
      sf.terminate();
      throw new Error('Engine was terminated');
    }
    this.sf = sf;
    sf.addMessageListener(this.onLine);
    const uciok = this.waitForLine((l) => l === 'uciok');
    sf.postMessage('uci');
    await uciok;
    sf.postMessage('setoption name UCI_Variant value 3check');
    this.applySkill();
    await this.ready();
  }

  private waitForLine(match: (l: string) => boolean, timeoutMs = 15000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const entry = {
        match,
        resolve: () => {
          clearTimeout(t);
          resolve();
        },
      };
      const t = setTimeout(() => {
        const i = this.lineWaiters.indexOf(entry);
        if (i >= 0) this.lineWaiters.splice(i, 1);
        reject(new Error('Engine did not respond in time'));
      }, timeoutMs);
      this.lineWaiters.push(entry);
    });
  }

  private ready(): Promise<void> {
    const p = this.waitForLine((l) => l === 'readyok');
    this.sf!.postMessage('isready');
    return p;
  }

  private applySkill() {
    const skill = levelSettings(this.level).skill;
    if (this.sf && skill !== this.appliedSkill) {
      this.sf.postMessage(`setoption name Skill Level value ${skill}`);
      this.appliedSkill = skill;
    }
  }

  setLevel(level: EngineLevel): void {
    this.level = level;
    // Applied before the next search (never mid-search).
    if (this.sf && !this.current) this.applySkill();
  }

  private whenIdle(): Promise<void> {
    if (!this.current) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  /** Reject the running search (if any) and tell the engine to stop. */
  private abortCurrent(reason: string) {
    const search = this.current;
    if (search && !search.settled) {
      search.settled = true;
      clearTimeout(search.timer);
      search.reject(new EngineAbortError(reason));
      this.sf?.postMessage('stop');
    }
    // `current` stays set until the engine emits its (ignored) bestmove,
    // so the next request waits for the engine to become idle.
  }

  async bestMove(uciMoves: string[]): Promise<string> {
    const gen = ++this.generation;
    this.abortCurrent('Superseded by a newer bestMove request');
    await this.init();
    // Wait for the engine to finish any aborted search. Several requests can be
    // queued here; only the newest (matching generation) proceeds.
    for (;;) {
      if (gen !== this.generation || this.disposed || !this.sf) {
        throw new EngineAbortError('Superseded before the search started');
      }
      if (!this.current) break;
      await this.whenIdle();
    }
    const sf = this.sf;

    const prev = this.lastMoves;
    const continues = prev !== null && prev.length <= uciMoves.length && prev.every((m, i) => m === uciMoves[i]);
    if (!continues) sf.postMessage('ucinewgame');
    this.lastMoves = [...uciMoves];
    this.applySkill();

    const movetime = levelSettings(this.level).movetime;
    return new Promise<string>((resolve, reject) => {
      const search: PendingSearch = {
        resolve,
        reject,
        settled: false,
        timer: setTimeout(() => {
          if (search.settled) return;
          search.settled = true;
          reject(new Error('Engine search timed out'));
          sf.postMessage('stop');
        }, movetime + 15000),
      };
      this.current = search;
      sf.postMessage('position startpos' + (uciMoves.length ? ' moves ' + uciMoves.join(' ') : ''));
      sf.postMessage(goCommand(this.level));
    });
  }

  stop(): void {
    this.generation++;
    this.abortCurrent('Search stopped');
  }

  terminate(): void {
    this.generation++;
    this.disposed = true;
    this.abortCurrent('Engine terminated');
    this.current = null;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    waiters.forEach((w) => w());
    this.lineWaiters = [];
    if (this.sf) {
      this.sf.removeMessageListener(this.onLine);
      this.sf.terminate();
      this.sf = null;
    }
  }
}

/** Factory — creates an independent Fairy-Stockfish instance (call init() first). */
export function createEngine(): EngineClient {
  return new FairyStockfishClient();
}
