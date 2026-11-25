import { describe, expect, it } from 'vitest';
import {
  isLegalMove,
  legalDests,
  needsPromotion,
  newGame,
  play,
  replay,
  resign,
  truncate,
} from './rules';
import type { GameState } from './types';

const playAll = (s: GameState, moves: string[]) => moves.reduce(play, s);

describe('three-check rules', () => {
  it('starts with no checks and no outcome', () => {
    const g = newGame();
    expect(g.turn).toBe('white');
    expect(g.checksGiven).toEqual({ white: 0, black: 0 });
    expect(g.outcome).toBeNull();
    expect(legalDests(g).get('e2')).toEqual(expect.arrayContaining(['e3', 'e4']));
  });

  it('third check ends the game with winner and reason three-check', () => {
    // 1.e4 e5 2.Qh5 Nc6 3.Qxf7+ Kxf7 4.Bc4+ d5 5.Bxd5+
    let g = replay(['e2e4', 'e7e5', 'd1h5', 'b8c6', 'h5f7']);
    expect(g.checksGiven).toEqual({ white: 1, black: 0 });
    expect(g.inCheck).toBe(true);
    expect(g.outcome).toBeNull();
    g = playAll(g, ['e8f7', 'f1c4', 'd7d5']);
    expect(g.checksGiven.white).toBe(2);
    expect(g.outcome).toBeNull();
    g = play(g, 'c4d5');
    expect(g.checksGiven).toEqual({ white: 3, black: 0 });
    expect(g.outcome).toEqual({ winner: 'white', reason: 'three-check' });
    expect(g.history.map(h => h.san)).toEqual([
      'e4', 'e5', 'Qh5', 'Nc6', 'Qxf7+', 'Kxf7', 'Bc4+', 'd5', 'Bxd5#',
    ]);
    // no more moves after game end
    expect(legalDests(g).size).toBe(0);
    expect(() => play(g, 'f7f6')).toThrow();
  });

  it('counts checks per side independently and encodes them in the FEN', () => {
    // 1.e4 e5 2.f4 Qh4+ 3.g3 Qxg3+ 4.hxg3: black has given 2 checks
    let g = replay(['e2e4', 'e7e5', 'f2f4', 'd8h4']);
    expect(g.checksGiven).toEqual({ white: 0, black: 1 });
    expect(g.fen.split(' ')[4]).toBe('3+2'); // chessops: remaining checks white+black
    g = playAll(g, ['g2g3', 'h4g3']);
    expect(g.checksGiven).toEqual({ white: 0, black: 2 });
    g = playAll(g, ['h2g3', 'b8c6', 'f1b5', 'a7a6', 'b5c6']);
    expect(g.checksGiven).toEqual({ white: 0, black: 2 });
    g = playAll(g, ['b7c6', 'd1h5', 'g8f6', 'h5f7']);
    expect(g.checksGiven).toEqual({ white: 1, black: 2 });
    expect(g.outcome).toBeNull();
  });

  it('checkmate still wins before three checks', () => {
    const g = replay(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(g.checksGiven).toEqual({ white: 0, black: 1 });
    expect(g.outcome).toEqual({ winner: 'black', reason: 'checkmate' });
    expect(g.history[3].san).toBe('Qh4#');
  });

  it('stalemate is a draw', () => {
    const g = play(newGame('7k/8/6K1/8/8/8/8/5Q2 w - - 0 1'), 'f1f7');
    expect(g.inCheck).toBe(false);
    expect(g.outcome).toEqual({ winner: null, reason: 'stalemate' });
  });

  it('handles promotion (and requires a promotion piece)', () => {
    const g0 = newGame('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(needsPromotion(g0, 'a7', 'a8')).toBe(true);
    expect(needsPromotion(g0, 'a1', 'a2')).toBe(false);
    expect(isLegalMove(g0, 'a7a8')).toBe(false);
    expect(() => play(g0, 'a7a8')).toThrow();
    const q = play(g0, 'a7a8q');
    expect(q.history[0]).toMatchObject({ uci: 'a7a8q', san: 'a8=Q' });
    expect(q.fen.startsWith('Q7/7k/')).toBe(true);
    const n = play(g0, 'a7a8n');
    expect(n.history[0].san).toBe('a8=N');
  });

  it('handles castling both ways and both UCI notations', () => {
    const start = newGame('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    expect(legalDests(start).get('e1')).toEqual(expect.arrayContaining(['g1', 'c1']));
    const ks = play(start, 'e1g1');
    expect(ks.history[0]).toMatchObject({ uci: 'e1g1', san: 'O-O' });
    expect(ks.fen.split(' ')[0].endsWith('R4RK1')).toBe(true);
    const ks2 = play(start, 'e1h1');
    expect(ks2.history[0].uci).toBe('e1g1');
    expect(ks2.fen).toBe(ks.fen);
    const qs = play(ks, 'e8c8');
    expect(qs.history[1]).toMatchObject({ uci: 'e8c8', san: 'O-O-O' });
    expect(qs.fen.split(' ')[0].startsWith('2kr3r')).toBe(true);
  });

  it('handles en passant', () => {
    const g = replay(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
    expect(g.history[4].san).toBe('exd6');
    const board = g.fen.split(' ')[0];
    expect(board.split('/')[3]).toBe('8'); // d5 pawn removed (rank 5)
    expect(board.split('/')[2]).toBe('p2P4'); // a6 pawn + d6 pawn
  });

  it('threefold repetition is a draw', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const g7 = replay([...shuffle, ...shuffle.slice(0, 3)]);
    expect(g7.outcome).toBeNull();
    const g8 = play(g7, 'f6g8');
    expect(g8.outcome).toEqual({ winner: null, reason: 'repetition' });
  });

  it('fifty-move rule is a draw', () => {
    const g = play(newGame('8/8/8/4k3/8/8/8/R3K3 w - - 99 60'), 'a1a2');
    expect(g.outcome).toEqual({ winner: null, reason: 'fifty-move' });
  });

  it('insufficient material only when both sides have a bare king', () => {
    const kk = play(newGame('8/8/8/4k3/8/8/3p4/4K3 w - - 0 1'), 'e1d2');
    expect(kk.outcome).toEqual({ winner: null, reason: 'insufficient' });
    // K+N vs K can still give checks in three-check → not a draw
    const kn = play(newGame('8/8/8/4k3/8/8/3p4/4K1N1 w - - 0 1'), 'e1d2');
    expect(kn.outcome).toBeNull();
  });

  it('resign and truncate (undo)', () => {
    const g = replay(['e2e4', 'e7e5', 'g1f3']);
    expect(resign(g, 'black').outcome).toEqual({ winner: 'white', reason: 'resign' });
    const u = truncate(g, 1);
    expect(u.history.map(h => h.uci)).toEqual(['e2e4']);
    expect(u.turn).toBe('black');
  });
});
