import { Chess, type Color, type Square } from 'chess.js';
import { createGame, play, position, type GameState, type Promotion } from '../chess/core';
import type { Opening } from './import';
import { compare } from './import';

export interface Edge { uci: string; san: string; to: string }
export interface OpeningNode { names: Opening[]; next: Map<string, Edge> }
export interface OpeningIndex { nodes: Map<string, OpeningNode>; paths: Map<string, string[]> }
/** chess.js emits an en-passant square only if a legal capture exists. */
export function positionKey(game: Chess): string { return game.fen().split(' ').slice(0, 4).join(' '); }

export function buildIndex(openings: Opening[]): OpeningIndex {
  const nodes = new Map<string, OpeningNode>();
  const paths = new Map<string, string[]>();
  function node(key: string) {
    if (!nodes.has(key)) nodes.set(key, { names: [], next: new Map() });
    return nodes.get(key)!;
  }
  for (const opening of openings) {
    if (paths.has(opening.id) || !opening.moves.length) throw new Error(`Invalid opening id/line: ${opening.id}`);
    const game = new Chess();
    const keys = [positionKey(game)];
    for (const uci of opening.moves) {
      const from = positionKey(game);
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error(`Invalid UCI: ${uci}`);
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      const to = positionKey(game);
      node(from).next.set(uci, { uci, san: move.san, to });
      node(to);
      keys.push(to);
    }
    const terminal = node(positionKey(game));
    // Several names may legitimately describe one position; retain all aliases.
    if (!terminal.names.some(o => o.eco === opening.eco && o.name === opening.name)) terminal.names.push(opening);
    paths.set(opening.id, keys);
  }
  return { nodes, paths };
}

export function resolvePosition(index: OpeningIndex, game: Chess) {
  return index.nodes.get(positionKey(game)) ?? { names: [], next: new Map<string, Edge>() };
}
export function searchOpenings(openings: Opening[], query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return openings.filter(o => words.every(word => `${o.eco} ${o.name}`.toLowerCase().includes(word)));
}
export function loadOpening(opening: Opening, side: Color): GameState {
  return opening.moves.reduce((state, uci) => play(state, uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, uci[4] as Promotion | undefined), createGame(side));
}

export interface TrainingPlan { index: OpeningIndex; opening: Opening; target: string; distance: Map<string, number>; reverse: Map<string, string[]> }
export function trainingPlan(index: OpeningIndex, opening: Opening): TrainingPlan {
  const path = index.paths.get(opening.id);
  if (!path) throw new Error(`Opening not indexed: ${opening.id}`);
  const target = path[path.length - 1];
  const reverse = new Map<string, string[]>();
  for (const [key, node] of index.nodes) for (const edge of node.next.values()) {
    if (!reverse.has(edge.to)) reverse.set(edge.to, []);
    reverse.get(edge.to)!.push(key);
  }
  const distance = new Map([[target, 0]]);
  const queue = [target];
  for (let i = 0; i < queue.length; i++) for (const from of reverse.get(queue[i]) ?? []) {
    if (distance.has(from)) continue;
    distance.set(from, distance.get(queue[i])! + 1); queue.push(from);
  }
  return { index, opening, target, distance, reverse };
}
export function trainingComplete(plan: TrainingPlan, state: GameState) {
  return positionKey(position(state)) === plan.target;
}
function trainingEdges(plan: TrainingPlan, state: GameState) {
  const game = new Chess(state.initialFen);
  const visited = new Set([positionKey(game)]);
  for (const san of state.moves.slice(0, state.cursor)) { game.move(san); visited.add(positionKey(game)); }
  // Permit indexed alternate move orders, including longer paths, but no cycles.
  // Recompute reachability without visited positions so an accepted deviation
  // cannot strand the learner behind a previously visited node.
  const reachable = new Set([plan.target]);
  const queue = [plan.target];
  for (let i = 0; i < queue.length; i++) for (const from of plan.reverse.get(queue[i]) ?? []) {
    if (visited.has(from) || reachable.has(from)) continue;
    reachable.add(from); queue.push(from);
  }
  return [...resolvePosition(plan.index, game).next.values()].filter(edge => !visited.has(edge.to) && reachable.has(edge.to));
}
function opponentReply(plan: TrainingPlan, state: GameState): GameState {
  if (trainingComplete(plan, state) || position(state).turn() === state.side) return state;
  const key = positionKey(position(state));
  const path = plan.index.paths.get(plan.opening.id)!;
  const preferred = plan.opening.moves[path.indexOf(key)];
  const edge = trainingEdges(plan, state).sort((a, b) =>
    Number(b.uci === preferred) - Number(a.uci === preferred) ||
    plan.distance.get(a.to)! - plan.distance.get(b.to)! || compare(a.uci, b.uci))[0];
  if (!edge) return state;
  return play(state, edge.uci.slice(0, 2) as Square, edge.uci.slice(2, 4) as Square, edge.uci[4] as Promotion | undefined);
}
export function startTraining(plan: TrainingPlan, side: Color): GameState { return opponentReply(plan, createGame(side)); }
export function trainMove(plan: TrainingPlan, state: GameState, from: Square, to: Square, promotion?: Promotion) {
  if (state.cursor !== state.moves.length) return { state, message: 'Вы просматриваете историю. Перейдите в конец или начните заново.', accepted: false };
  if (trainingComplete(plan, state)) return { state, message: 'Линия завершена. Выберите другую или начните заново.', accepted: false };
  if (position(state).turn() !== state.side) return { state, message: 'Сейчас ход соперника.', accepted: false };
  const next = play(state, from, to, promotion);
  if (next === state) return { state, message: 'Нелегальный ход. Соблюдайте очередь и правила.', accepted: false };
  const edge = trainingEdges(plan, state).find(edge => edge.to === positionKey(position(next)));
  if (!edge) return { state, message: 'Ход легален, но не ведёт к выбранной линии в этой выборке. Попробуйте другой ход.', accepted: false };
  const replied = opponentReply(plan, next);
  return { state: replied, message: trainingComplete(plan, replied)
    ? 'Верно. Линия завершена.' : 'Верно. Ответ соперника взят из дебютного дерева.', accepted: true };
}
