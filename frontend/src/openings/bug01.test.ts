import { expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { createGame, navigate, play, position, preview, restart } from '../chess/core';
import { openings, openingIndex } from './catalog';
import { buildIndex, loadOpening, openingProgress, resolvePosition } from './model';
import type { Opening } from './import';

const ruy = openings.find(o => o.eco === 'C60' && o.name === 'Ruy Lopez')!;

it('BUG-01 terminal replay is distinct from the initial exploration position', () => {
  expect(loadOpening(ruy, 'w').moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  expect(openingProgress(openingIndex, ruy, position(createGame()))).toMatchObject({ status: 'next', next: { san: 'e4' } });
});

it('BUG-01 recommendations and legal/conditional previews never repeat a played e5', () => {
  let state = createGame();
  const expected = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
  for (const san of expected) {
    const game = position(state);
    expect(openingProgress(openingIndex, ruy, game)).toMatchObject({ status: 'next', next: { san } });
    expect(game.moves()).toContain(san);
    game.move(san);
    const last = game.history({ verbose: true }).at(-1)!;
    state = play(state, last.from, last.to);
    if (san === 'e4') {
      const before = JSON.stringify(state);
      expect(preview(state, 'e7')).toMatchObject({ hypothetical: false });
      expect(preview(state, 'g1')).toMatchObject({ hypothetical: true });
      expect(JSON.stringify(state)).toBe(before);
    }
    if (san === 'e5') {
      expect(openingProgress(openingIndex, ruy, position(state))).toMatchObject({ next: { san: 'Nf3' } });
      expect([...resolvePosition(openingIndex, position(state)).next.values()].map(e => e.san)).not.toContain('e5');
      expect(preview(state, 'e4')?.moves.map(m => m.to)).not.toContain('e5');
      expect(preview(state, 'e5')?.hypothetical).toBe(true);
    }
  }
  expect(openingProgress(openingIndex, ruy, position(state))).toEqual({ status: 'complete' });
  expect(openingProgress(openingIndex, ruy, position(navigate(state, 1)))).toMatchObject({ next: { san: 'e5' } });
  const branch = play(navigate(state, 1), 'c7', 'c5');
  expect(branch.moves).toEqual(['e4', 'c5']);
  expect(openingProgress(openingIndex, ruy, position(branch))).toEqual({ status: 'outside' });
  expect(state.moves).toEqual(expected);
  for (const side of ['w', 'b'] as const) {
    const reset = restart(state, side);
    expect(position(reset).fen()).toBe(new Chess().fen());
    expect(reset.side).toBe(side);
    expect(reset.moves).toEqual([]);
    expect(openingProgress(openingIndex, ruy, position(reset))).toMatchObject({ next: { san: 'e4' } });
  }
});

it('BUG-01 guidance rejoins the selected line by transposed position, not cursor', () => {
  const opening: Opening = { id: 'transpose', eco: 'D00', name: 'Fixture',
    moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'g1f3', 'g8f6', 'b1c3'] };
  const index = buildIndex([opening]);
  const game = new Chess();
  game.loadPgn('1. Nf3 d5 2. d4 Nf6 3. c4 e6');
  expect(openingProgress(index, opening, game)).toMatchObject({ status: 'next', next: { san: 'Nc3' } });
  game.move('Nc3');
  expect(openingProgress(index, opening, game)).toEqual({ status: 'complete' });
  const wrongTurn = new Chess(game.fen().replace(' b ', ' w '));
  expect(openingProgress(index, opening, wrongTurn)).toEqual({ status: 'outside' });
});
