import { describe, expect, it } from 'vitest';
import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';
import { createGame, navigate, play, position, preview, restart, status, type GameState } from './core';
function line(moves: string[], state = createGame()) {
  return moves.reduce((s, m) => play(s, m.slice(0,2) as Square,m.slice(2,4) as Square),state);
}
function snapshot(s: GameState) { return { state: JSON.stringify(s), fen: position(s).fen(), turn: position(s).turn(), history: position(s).history() }; }
describe('C01 legal moves and turn', () => {
  it('accepts e4; rejects illegal and out of turn without mutation', () => {
    const s = createGame(); expect(play(s,'e2','e5')).toBe(s); expect(play(s,'e7','e5')).toBe(s);
    const next = play(s,'e2','e4'); expect(position(next).turn()).toBe('b'); expect(next.moves).toEqual(['e4']);
    expect(position(s).fen()).toBe(DEFAULT_POSITION);
  });
});
describe('C02 castling', () => {
  it.each([['g1','f1'],['c1','d1']] as const)('white castle to %s moves rook', (to, rook) => {
    const next=play(createGame('w','r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),'e1',to);
    expect(position(next).get(to)?.type).toBe('k'); expect(position(next).get(rook)?.type).toBe('r');
  });
  it.each([['g8','f8'],['c8','d8']] as const)('black castle to %s moves rook', (to, rook) => {
    const next=play(createGame('b','r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'),'e8',to);
    expect(position(next).get(to)?.type).toBe('k'); expect(position(next).get(rook)?.type).toBe('r');
  });
  it.each(['r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1','k4r2/8/8/8/8/8/8/4K2R w K - 0 1','k3r3/8/8/8/8/8/8/4K2R w K - 0 1'])('rejects no rights, through check, in check', fen=>{
    const s=createGame('w',fen); expect(play(s,'e1','g1')).toBe(s);
  });
});
describe('C03 en passant', () => {
  it('captures the passed pawn and expires after another move', () => {
    const s=line(['e2e4','a7a6','e4e5','d7d5']); const next=play(s,'e5','d6');
    expect(position(next).get('d5')).toBeUndefined(); expect(position(next).get('d6')?.color).toBe('w');
    const expired=line(['g1f3','a6a5'],s); expect(play(expired,'e5','d6')).toBe(expired);
  });
});
describe('C04 promotion',()=>{
  for (const color of ['w','b'] as const) for (const piece of ['q','r','b','n'] as const) it(`${color} promotes to ${piece}`,()=>{
    const s=createGame(color,color==='w'?'7k/P7/8/8/8/8/8/7K w - - 0 1':'7k/8/8/8/8/8/p7/7K b - - 0 1');
    const from=color==='w'?'a7':'a2',to=color==='w'?'a8':'a1';
    expect(play(s,from,to)).toBe(s); expect(position(play(s,from,to,piece)).get(to)).toEqual({type:piece,color});
  });
});
describe('C05 check, mate, stalemate, pin',()=>{
  it('detects check, mate and stalemate',()=>{
    expect(status(position(createGame('w','4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')))).toContain('шах');
    expect(status(position(line(['f2f3','e7e5','g2g4','d8h4'])))).toContain('Мат');
    expect(status(position(createGame('b','7k/5K2/6Q1/8/8/8/8/8 b - - 0 1')))).toContain('Пат');
  });
  it('cannot expose king with pinned rook',()=>{
    const s=createGame('w','k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
    expect(play(s,'e2','d2')).toBe(s); expect(preview(s,'e2')?.moves.some(m=>m.to==='d2')).toBe(false);
  });
});
describe('C06 history, C07 reset',()=>{
  it('restores exact FEN, preserves future, branches only after a legal move',()=>{
    const first=line(['e2e4']); const full=line(['e7e5','g1f3'],first); const back=navigate(full,1);
    expect(position(back).fen()).toBe(position(first).fen()); expect(navigate(back,3)).toEqual(full);
    expect(play(back,'e7','e4')).toBe(back);
    expect(play(back,'c7','c5').moves).toEqual(['e4','c5']); expect(navigate(full,-9).cursor).toBe(0);
  });
  it('restart and side change clear game',()=>{
    const s=line(['e2e4']); expect(restart(s)).toEqual(createGame()); expect(restart(s,'b')).toEqual(createGame('b'));
  });
});
describe('C08/C09 preview invariants',()=>{
  it('colors are relative to selected side',()=>{
    expect(preview(createGame(),'e2')?.color).toBe('blue'); expect(preview(createGame(),'e7')?.color).toBe('red');
    expect(preview(createGame('b'),'e2')?.color).toBe('red'); expect(preview(createGame('b'),'e7')?.color).toBe('blue');
  });
  it('out-of-turn preview never changes live state or allows move',()=>{
    const s=line(['e2e4','e7e5']);const before=snapshot(s);
    const hints=preview(s,'g8'); expect(hints?.hypothetical).toBe(true); expect(hints?.moves.map(m=>m.to)).toContain('f6');
    expect(play(s,'g8','f6')).toBe(s); expect(snapshot(s)).toEqual(before);
  });
  it('actual en passant and castling appear in previews',()=>{
    const s=line(['e2e4','a7a6','e4e5','d7d5']); expect(preview(s,'e5')?.moves.some(m=>m.isEnPassant())).toBe(true);
    expect(preview(createGame('w','4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'),'e1')?.moves.filter(m=>m.isKingsideCastle()||m.isQueensideCastle())).toHaveLength(2);
  });
  it('preview on historical position and hypothetical EP cleanup preserve state',()=>{
    const s=navigate(line(['e2e4','a7a6','e4e5','d7d5','g1f3']),4); const before=snapshot(s);
    preview(s,'d5');preview(s,'e5'); expect(snapshot(s)).toEqual(before);
  });
});
it('C05 repetition remains detectable after history replay',()=>{
  const s=line(['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']);
  expect(status(position(s))).toContain('троекратное'); expect(play(s,'e2','e4')).toBe(s);
  expect(position(navigate(s,4)).isThreefoldRepetition()).toBe(false);
});
it('C09 hypothetical preview has no stale en passant',()=>{
  const s=line(['e2e4','a7a6','e4e5','d7d5']);
  expect(preview(s,'d5')?.moves.some(m=>m.isEnPassant())).toBe(false);
  expect(preview(s,'a4')).toBeNull();
});

describe('Bugfix 01: safe conditional preview', () => {
  it.each([
    { moves: ['e2e4', 'f7f6', 'd1h5'], checking: 'h5' as Square },
    { moves: ['f2f3', 'e7e5', 'e2e3', 'd8h4'], checking: 'h4' as Square },
  ])('suppresses the whole unsafe preview for $checking, not just king capture', ({ moves, checking }) => {
    const state = line(moves);
    const before = snapshot(state);
    expect(position(state).isCheck()).toBe(true);
    expect(preview(state, checking)).toBeNull();
    // Check every piece, including other pieces of the checking side.
    for (const piece of position(state).board().flat()) {
      if (!piece) continue;
      const hints = preview(state, piece.square);
      expect(hints?.moves.some(move => move.captured === 'k') ?? false).toBe(false);
      if (piece.color !== position(state).turn()) expect(hints).toBeNull();
    }
    expect(snapshot(state)).toEqual(before);
  });

  it('keeps a pinned piece constrained after a hypothetical turn change', () => {
    const state = createGame('w', 'k3r3/8/8/8/8/8/4R3/4K3 b - - 0 1');
    const before = snapshot(state);
    const hints = preview(state, 'e2');
    expect(hints?.hypothetical).toBe(true);
    expect(hints?.moves.map(move => move.to).sort()).toEqual(['e3', 'e4', 'e5', 'e6', 'e7', 'e8']);
    expect(hints?.moves.find(move => move.to === 'e8')?.captured).toBe('r');
    expect(snapshot(state)).toEqual(before);
  });

  it.each([
    { moves: ['e2e4', 'a7a6', 'e4e5', 'd7d5'], actual: 'e5' as Square, conditional: 'c7' as Square, target: 'd6' },
    { moves: ['a2a3', 'e7e5', 'a3a4', 'e5e4', 'd2d4'], actual: 'e4' as Square, conditional: 'c2' as Square, target: 'd3' },
  ])('clears EP when it would invent $conditional-$target, preserving actual EP', ({ moves, actual, conditional, target }) => {
    const state = line(moves);
    const before = snapshot(state);
    const live = position(state);
    // Control: retaining EP really does invent a capture for this fixture.
    const fields = live.fen().split(' ');
    fields[1] = live.turn() === 'w' ? 'b' : 'w';
    const unsafe = new Chess(fields.join(' '), { skipValidation: true });
    expect(unsafe.moves({ square: conditional, verbose: true }).some(move => move.to === target && move.isEnPassant())).toBe(true);

    expect(preview(state, actual)?.moves.some(move => move.to === target && move.isEnPassant())).toBe(true);
    const hints = preview(state, conditional);
    expect(hints?.hypothetical).toBe(true);
    expect(hints?.moves).not.toHaveLength(0);
    expect(hints?.moves.some(move => move.to === target)).toBe(false);
    expect(snapshot(state)).toEqual(before);
  });
});
