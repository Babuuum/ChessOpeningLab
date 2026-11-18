import { Chess, DEFAULT_POSITION, type Color, type Square } from 'chess.js';

export type Promotion = 'q' | 'r' | 'b' | 'n';
export interface GameState { initialFen: string; moves: string[]; cursor: number; side: Color }
export function createGame(side: Color = 'w', initialFen = DEFAULT_POSITION): GameState {
  new Chess(initialFen);
  return { initialFen, moves: [], cursor: 0, side };
}
export function position(state: GameState): Chess {
  const game = new Chess(state.initialFen);
  for (const san of state.moves.slice(0, state.cursor)) game.move(san);
  return game;
}
export function navigate(state: GameState, cursor: number): GameState {
  return { ...state, cursor: Math.max(0, Math.min(state.moves.length, cursor)) };
}
export function restart(state: GameState, side = state.side): GameState { return createGame(side); }
export function candidates(state: GameState, from: Square, to: Square) {
  return position(state).moves({ square: from, verbose: true }).filter(m => m.to === to);
}
export function play(state: GameState, from: Square, to: Square, promotion?: Promotion): GameState {
  const game = position(state);
  if (game.isGameOver()) return state;
  const moves = game.moves({ square: from, verbose: true }).filter(m => m.to === to);
  if (!moves.length || (moves.some(m => m.promotion) && !promotion)) return state;
  try {
    const move = game.move({ from, to, promotion });
    return { ...state, moves: [...state.moves.slice(0, state.cursor), move.san], cursor: state.cursor + 1 };
  } catch { return state; }
}
export function preview(state: GameState, square: Square) {
  const live = position(state);
  const piece = live.get(square);
  if (!piece) return null;
  const hypothetical = piece.color !== live.turn();
  let copy = new Chess(live.fen());
  if (hypothetical) {
    // Passing while in check would leave the inactive king attacked.
    // chess.js assumes that invariant when generating legal moves.
    if (live.isCheck()) return null;
    const fields = live.fen().split(' ');
    fields[1] = piece.color;
    fields[3] = '-'; // EP is only valid for the actual side to move.
    copy = new Chess(fields.join(' '));
  }
  return { color: piece.color === state.side ? 'blue' as const : 'red' as const,
    hypothetical, moves: copy.moves({ square, verbose: true }) };
}
export function status(game: Chess): string {
  if (game.isCheckmate()) return `Мат · победили ${game.turn() === 'w' ? 'чёрные' : 'белые'}`;
  if (game.isStalemate()) return 'Пат · ничья';
  if (game.isThreefoldRepetition()) return 'Ничья · троекратное повторение';
  if (game.isInsufficientMaterial()) return 'Ничья · недостаточно материала';
  if (game.isDraw()) return 'Ничья';
  return `Ход ${game.turn() === 'w' ? 'белых' : 'чёрных'}${game.isCheck() ? ' · шах' : ''}`;
}
