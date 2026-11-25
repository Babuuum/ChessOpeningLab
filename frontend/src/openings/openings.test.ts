import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { navigate, position, type Promotion } from '../chess/core';
import { families, parseTsv, selectSample, type Opening } from './import';
import { catalog, openings, openingIndex } from './catalog';
import { buildIndex, loadOpening, positionKey, resolvePosition, searchOpenings, startTraining, trainingComplete, trainingPlan, trainMove } from './model';

function chess(pgn: string) { const game = new Chess(); game.loadPgn(pgn); return game; }
function fixture(name: string, pgn: string, id = name): Opening {
  return { id, name, eco: 'D00', moves: chess(pgn).history({ verbose: true }).map(m => m.from + m.to + (m.promotion ?? '')) };
}
const canonical = fixture('Target fixture', '1. d4 d5 2. c4 e6 3. Nf3 Nf6');
const alternate = fixture('Transpose fixture', '1. Nf3 d5 2. d4 Nf6 3. c4 e6');

describe('O01 import validation and deterministic sampling', () => {
  it('rejects illegal/empty/annotated/custom-start rows; reports source row, deduplicates exact lines', () => {
    const parsed = parseTsv('eco\tname\tpgn\nB20\tSicilian Defense\t1. e4 c5\nB20\tSicilian Defense\t1. e4 c5\nB20\tIllegal\t1. e4 e5 2. e5\nB99\tEmpty\t*\nB20\tAnnotation\t1. e4 {comment} c5\nB20\tFEN\t[FEN "fake"]\nZ99\tBad ECO\t1. d4\n');
    expect(parsed.openings).toEqual([{ eco: 'B20', name: 'Sicilian Defense', moves: ['e2e4', 'c7c5'] }]);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.rejected.map(row => row.row)).toEqual([4, 5, 6, 7, 8]);
    expect(() => parseTsv('name\tpgn')).toThrow('header');
  });
  it('ships 100 real named legal lines across ten families, with stable selection independent of input order', () => {
    expect(openings).toHaveLength(100);
    expect(catalog).toHaveLength(10);
    expect(catalog.map(entry => entry.family)).toContain('Scandinavian Defense');
    expect(catalog.every(entry => entry.variants.length === 10)).toBe(true);
    expect(catalog.flatMap(entry => entry.variants)).toEqual(openings);
    for (const family of families) expect(openings.filter(o => o.name.split(':')[0] === family)).toHaveLength(10);
    expect(selectSample([...openings, ...openings])).toEqual(openings);
    expect(selectSample([...openings].reverse())).toEqual(openings);
    expect(new Set(openings.map(o => JSON.stringify([o.eco, o.name, o.moves]))).size).toBe(100);
    for (const opening of openings) {
      const game = position(loadOpening(opening, 'w'));
      expect(resolvePosition(openingIndex, game).names.some(o => o.eco === opening.eco && o.name === opening.name)).toBe(true);
      expect(game.history()).toHaveLength(opening.moves.length);
    }
  });
  it('searches case-insensitive name and ECO, including empty and no-match results', () => {
    expect(searchOpenings(openings, 'b20 sicilian').every(o => o.eco === 'B20' && o.name.startsWith('Sicilian'))).toBe(true);
    expect(searchOpenings(openings, 'b20 sicilian').length).toBeGreaterThan(0);
    expect(searchOpenings(openings, '')).toHaveLength(100);
    expect(searchOpenings(openings, 'not an opening')).toEqual([]);
  });
});

describe('O02 position graph and transpositions', () => {
  it('names only exact terminal positions; prefixes show branches without borrowing a future name', () => {
    const index = buildIndex([canonical]);
    const prefix = resolvePosition(index, chess('1. d4 d5'));
    expect(prefix.names).toEqual([]); expect([...prefix.next.values()].map(e => e.san)).toEqual(['c4']);
    expect(resolvePosition(index, chess('1. e4')).names).toEqual([]);
    expect(resolvePosition(index, chess('1. e4')).next.size).toBe(0);
    expect(resolvePosition(index, chess('1. Nf3 d5 2. d4 Nf6 3. c4 e6')).names).toEqual([canonical]);
  });
  it('deduplicates shared edges and preserves multiple terminal aliases', () => {
    const index = buildIndex([canonical, alternate]);
    const initial = resolvePosition(index, new Chess());
    expect(initial.next.size).toBe(2);
    expect(resolvePosition(index, position(loadOpening(canonical, 'w'))).names).toEqual([canonical, alternate]);
    for (const [key, node] of openingIndex.nodes) for (const edge of node.next.values()) {
      const game = new Chess(`${key} 0 1`);
      expect(game.move({ from: edge.uci.slice(0,2), to: edge.uci.slice(2,4), promotion: edge.uci[4] }).san).toBe(edge.san);
      expect(positionKey(game)).toBe(edge.to);
    }
  });
  it('ignores move counters and unusable EP, retains turn, castling rights and legal EP', () => {
    const start = new Chess();
    expect(positionKey(new Chess(start.fen().replace('0 1', '7 12')))).toBe(positionKey(start));
    expect(positionKey(new Chess(start.fen().replace('w KQkq', 'b KQkq')))).not.toBe(positionKey(start));
    expect(positionKey(new Chess(start.fen().replace('KQkq', '-')))).not.toBe(positionKey(start));
    const noCapture = chess('1. e4');
    expect(positionKey(noCapture)).toBe(positionKey(new Chess(noCapture.fen({ forceEnpassantSquare: true }))));
    const ep = chess('1. e4 a6 2. e5 d5');
    expect(positionKey(ep)).not.toBe(positionKey(new Chess(ep.fen().replace('d6', '-'))));
    const pinnedEp = 'k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
    expect(positionKey(new Chess(pinnedEp))).toBe(positionKey(new Chess(pinnedEp.replace('d6', '-'))));
  });
});

describe('O03 training', () => {
  const index = buildIndex([canonical, alternate]);
  const plan = trainingPlan(index, canonical);
  it.each(['w', 'b'] as const)('starts, auto-replies, completes, restarts for %s', side => {
    let state = startTraining(plan, side);
    expect(state.cursor).toBe(side === 'w' ? 0 : 1);
    expect(position(state).turn()).toBe(side);
    while (!trainingComplete(plan, state)) {
      const uci = canonical.moves[state.cursor];
      const result = trainMove(plan, state, uci.slice(0,2) as Square, uci.slice(2,4) as Square);
      expect(result.accepted).toBe(true); state = result.state;
      if (trainingComplete(plan, state)) expect(result.message).toContain('Линия завершена');
    }
    expect(state.moves).toEqual(position(loadOpening(canonical, side)).history());
    expect(trainMove(plan, state, 'a2', 'a3').state).toBe(state);
    expect(startTraining(plan, side).cursor).toBe(side === 'w' ? 0 : 1);
  });
  it('rejects a legal deviation and illegal moves without mutation; history is review-only', () => {
    const state = startTraining(plan, 'w');
    expect(trainMove(plan, state, 'e2', 'e4')).toMatchObject({ accepted: false, state, message: expect.stringContaining('легален') });
    expect(trainMove(plan, state, 'e2', 'e5')).toMatchObject({ accepted: false, state, message: expect.stringContaining('Нелегальный') });
    expect(trainMove(plan, state, 'd7', 'd5').state).toBe(state);
    const played = trainMove(plan, state, 'd2', 'd4').state;
    const past = navigate(played, 0);
    expect(trainMove(plan, past, 'd2', 'd4')).toMatchObject({ accepted: false, state: past, message: expect.stringContaining('историю') });
    expect(state.moves).toEqual([]);
  });
  it('accepts an indexed transposition to the chosen target rather than another named opening', () => {
    let state = startTraining(plan, 'w');
    for (const [from, to] of [['g1','f3'], ['d2','d4'], ['c2','c4']] as const) {
      const result = trainMove(plan, state, from, to);
      expect(result.accepted).toBe(true); state = result.state;
    }
    expect(trainingComplete(plan, state)).toBe(true);
    expect(positionKey(position(state))).toBe(positionKey(position(loadOpening(canonical, 'w'))));
  });
  it('accepts longer indexed move orders, but rejects a cycle through a visited position', () => {
    const target = fixture('Short target', '1. e4 e5');
    const detour = fixture('Long route', '1. Nf3 e5 2. Ng1 Nc6 3. e4 Nb8');
    const cyclic = fixture('Cycle', '1. Nf3 Nf6 2. Ng1 Ng8 3. e4 e5');
    const index = buildIndex([target, detour, cyclic]);
    const plan = trainingPlan(index, target);
    let state = startTraining(plan, 'w');
    let result = trainMove(plan, state, 'g1', 'f3');
    expect(result.accepted).toBe(true); state = result.state;
    // Opponent chooses e5 (closer to target) over Nf6; subsequent replies stay indexed.
    result = trainMove(plan, state, 'f3', 'g1');
    expect(result.accepted).toBe(true); state = result.state;
    result = trainMove(plan, state, 'e2', 'e4');
    expect(result.accepted).toBe(true);
    expect(trainingComplete(plan, result.state)).toBe(true);

    const cycleIndex = buildIndex([target, cyclic]);
    const cyclePlan = trainingPlan(cycleIndex, target);
    state = startTraining(cyclePlan, 'w');
    // Entering this branch would require returning to the already visited initial position.
    expect(trainMove(cyclePlan, state, 'g1', 'f3')).toMatchObject({ accepted: false, state });
  });
  it.each(openings)('can reach $eco $name for both colors without unbounded auto replies', opening => {
    for (const side of ['w','b'] as const) {
      const plan = trainingPlan(openingIndex, opening);
      let state = startTraining(plan, side);
      for (let i = 0; i < opening.moves.length && !trainingComplete(plan, state); i++) {
        const key = positionKey(position(state));
        const edge = [...resolvePosition(openingIndex, position(state)).next.values()].find(e =>
          (plan.distance.get(e.to) ?? Infinity) < plan.distance.get(key)!);
        expect(edge, opening.name).toBeDefined();
        const uci = edge!.uci;
        const result = trainMove(plan, state, uci.slice(0,2) as Square, uci.slice(2,4) as Square, uci[4] as Promotion | undefined);
        expect(result.accepted, opening.name).toBe(true); state = result.state;
      }
      expect(trainingComplete(plan, state), opening.name).toBe(true);
    }
  });
});
