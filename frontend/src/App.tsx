import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import { candidates, createGame, navigate, play, position, preview, restart, status, type Promotion } from './chess/core';

import type { Opening } from './openings/import';
import { openingIndex } from './openings/catalog';
import { OpeningCatalog } from './openings/OpeningCatalog';
import { loadOpening, resolvePosition, startTraining, trainingComplete, trainingPlan, trainMove } from './openings/model';

export default function App() {
  const [mode, setMode] = useState<'home' | 'explore' | 'training'>('home');
  const [state, setState] = useState(() => createGame());
  const [trainingLine, setTrainingLine] = useState<Opening | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const plan = useMemo(() => trainingLine ? trainingPlan(openingIndex, trainingLine) : null, [trainingLine]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const promotionDialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const game = position(state);
  const resolved = resolvePosition(openingIndex, game);
  const training = mode === 'training' && !!plan;
  const complete = training && trainingComplete(plan!, state);
  const hints = selected ? preview(state, selected) : null;
  const [notice, setNotice] = useState('');
  const clear = () => { setSelected(null); setPromotion(null); setNotice(''); };
  useEffect(() => {
    if (!promotion) return;
    const dialog = promotionDialogRef.current;
    if (!dialog) return;
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const returnFocus = returnFocusRef.current;
    const board = boardRef.current;
    first.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setSelected(null);
        setPromotion(null);
        setNotice('');
      } else if (event.key === 'Tab') {
        const active = document.activeElement;
        if (!dialog!.contains(active) || (event.shiftKey ? active === first : active === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }
    function keepFocusInside(event: FocusEvent) {
      if (!dialog!.contains(event.target as Node)) first.focus();
    }
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', keepFocusInside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', keepFocusInside);
      (returnFocus?.isConnected ? returnFocus : board)?.focus();
    };
  }, [promotion]);
  function begin(opening: Opening, train: boolean) {
    clear(); setCatalogOpen(false);
    if (train) {
      setTrainingLine(opening); setMode('training');
      setState(startTraining(trainingPlan(openingIndex, opening), state.side));
    } else {
      setTrainingLine(null); setMode('explore'); setState(loadOpening(opening, state.side));
    }
  }
  function reset(side = state.side) {
    setState(training ? startTraining(plan!, side) : restart(state, side)); clear();
  }
  function commitMove(from: Square, to: Square, piece?: Promotion) {
    if (training) {
      const result = trainMove(plan!, state, from, to, piece);
      setNotice(result.message);
      if (!result.accepted) return false;
      setState(result.state); setSelected(null); setPromotion(null); return true;
    }
    const next = play(state, from, to, piece);
    if (next === state) { setNotice('Ход недоступен. Соблюдайте очередь и правила.'); return false; }
    setState(next); clear(); return true;
  }
  function attempt(from: Square, to: Square) {
    if (promotion || game.isGameOver()) return false;
    if (training && (complete || state.cursor !== state.moves.length)) return commitMove(from, to);
    const options = candidates(state, from, to);
    if (options.some(m => m.promotion)) {
      // Capture before the background becomes inert. A piece node may be
      // replaced/reused on promotion, so board interactions return to the board.
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement && active !== document.body && !boardRef.current?.contains(active) ? active : boardRef.current;
      setPromotion({ from, to });
      return false;
    }
    return commitMove(from, to);
  }
  function select(square: Square) {
    if (promotion) return;
    if (selected && selected !== square && game.get(selected)?.color !== game.get(square)?.color) {
      const accepted = attempt(selected, square);
      if (!accepted && game.get(square)) setSelected(square);
      return;
    }
    setSelected(selected === square ? null : game.get(square) ? square : null);
    setNotice('');
  }
  const squareStyles: Record<string, CSSProperties> = {};
  if (selected) squareStyles[selected] = { outline: '3px solid #f4bf57', outlineOffset: '-3px' };
  hints?.moves.forEach(move => {
    const capture = move.isCapture() || move.isEnPassant();
    const red = hints.color === 'red';
    squareStyles[move.to] = {
      background: capture ? `radial-gradient(circle, transparent 53%, ${red ? '#d52d46' : '#1971d9'} 55%, ${red ? '#d52d46' : '#1971d9'} 68%, transparent 70%)`
        : red ? 'linear-gradient(45deg, transparent 36%, #d52d46cc 37%, #d52d46cc 63%, transparent 64%), linear-gradient(-45deg, transparent 36%, #d52d46cc 37%, #d52d46cc 63%, transparent 64%)'
        : 'radial-gradient(circle, #1971d9d9 22%, transparent 24%)',
      ...(capture ? { outline: `3px ${red ? 'dashed' : 'solid'} ${red ? '#d52d46' : '#1971d9'}`, outlineOffset: '-4px' } : {}),
    };
  });
  return <div className="shell">
    <div inert={!!promotion}>
    <header><a href="#" onClick={e => { e.preventDefault(); clear(); setMode('home'); }} className="brand"><span className="brand-icon">♞</span><span>ChessOpening <b>Lab</b><small>Лаборатория дебютов</small></span></a><span className="badge">CHESS CORE · MVP</span></header>
    <div className="banner">Место для будущего баннера</div>
    {mode === 'home' ? <main className="home"><div className="eyebrow">ОТ ПЕРВОГО ХОДА К ПОНИМАНИЮ</div><h1>Каждый ход —<br/><em>новая возможность.</em></h1><p>Исследуйте позиции и проверяйте идеи на интерактивной доске.</p><div className="mode-grid"><button className="mode-card" onClick={() => setMode('explore')}><span>01 / СВОБОДНАЯ ДОСКА</span><h2>Исследовать ↗</h2><p>Легальные ходы, варианты и история партии.</p></button><button className="mode-card secondary" onClick={() => { clear(); setTrainingLine(null); setMode('training'); }}><span>02 / ДЕБЮТНОЕ ДЕРЕВО</span><h2>Тренировать ↗</h2><p>Выберите реальную линию и отработайте её за обе стороны.</p></button></div></main>
    : mode === 'training' && !trainingLine ? <main className="training-picker"><h1>Тренировка дебютов</h1><p>Выберите линию. Соперник отвечает только ходами из дерева; цель — её конечная позиция.</p><label className="side-label">Ваша сторона<select aria-label="Ваша сторона" value={state.side} onChange={e => { setState(createGame(e.target.value as 'w'|'b')); clear(); }}><option value="w">Белые</option><option value="b">Чёрные</option></select></label><OpeningCatalog onSelect={begin} /><button onClick={() => { setMode('explore'); setState(createGame(state.side)); clear(); }}>Перейти к исследованию</button></main>
    : <main><div className="page-title"><div><div className="eyebrow">СВОБОДНАЯ ДОСКА</div><h1>{training ? 'Тренировка' : 'Исследование'}</h1></div><div className="page-actions"><button onClick={() => setCatalogOpen(!catalogOpen)}>Каталог</button><button onClick={() => { clear(); setTrainingLine(null); setMode('training'); }}>Тренировка ↗</button>{training && <button onClick={() => { clear(); setMode('explore'); }}>Исследовать позицию</button>}</div></div><div className="workspace"><section className="board-panel" aria-label="Шахматная доска"><div className="board-top"><span>◉ {state.side === 'w' ? 'Чёрные' : 'Белые'}</span><span>{training ? 'Ответы из дерева' : 'Исследуйте обе стороны'}</span></div><div className="board" data-testid="board" ref={boardRef} tabIndex={-1}><Chessboard options={{id:'explore-board', position:game.fen(), boardOrientation:state.side === 'w' ? 'white' : 'black', squareStyles,
      darkSquareStyle:{backgroundColor:'#6b8b7f'}, lightSquareStyle:{backgroundColor:'#ebeee3'},
      onSquareClick:({square}) => select(square as Square),
      canDragPiece:({square}) => !promotion && !game.isGameOver() && !complete && (!training || (state.cursor === state.moves.length && game.turn() === state.side)) && game.get(square as Square)?.color === game.turn(),
      onPieceDrag:({square}) => { setSelected(square as Square); setNotice(''); },
      onPieceDrop:({sourceSquare,targetSquare}) => targetSquare ? attempt(sourceSquare as Square,targetSquare as Square) : false,
    }}/></div><div className="board-top"><span>◉ {state.side === 'w' ? 'Белые' : 'Чёрные'}</span><span>Ваша сторона</span></div><div className="legend"><span>🔵 ● Союзные</span><span>🔴 × Соперник</span><span>◯ Взятие</span></div></section>
    <aside><section className="card"><div className="eyebrow">ПОЗИЦИЯ</div><h2 role="status" aria-label="Статус партии" data-testid="game-status">{status(game)}</h2><label className="side-label">Ваша сторона<select aria-label="Ваша сторона" value={state.side} onChange={e => { reset(e.target.value as 'w'|'b'); }}><option value="w">Белые</option><option value="b">Чёрные</option></select></label><p className="muted">Смена стороны начинает новую партию.</p><div className="hint" data-testid="preview-info">{hints ? `${hints.color === 'blue' ? 'Синие ● — союзная фигура.' : 'Красные × — фигура соперника.'} ${hints.hypothetical ? 'Предварительный просмотр при условной передаче хода. Это не прогноз и не карта атак.' : 'Легальные ходы текущей стороны.'}` : training ? 'Выберите свою фигуру. За соперника отвечает дебютное дерево.' : 'Выберите фигуру, чтобы увидеть доступные ходы. Играйте за обе стороны по очереди.'}</div>{notice && <p role="alert">{notice}</p>}</section>
    {training && <section className="card training-info" aria-label="Текущая тренировка"><h2>{trainingLine!.eco} {trainingLine!.name}</h2><p role="status" data-testid="training-status">{state.cursor !== state.moves.length ? 'Просмотр истории — вернитесь в конец для продолжения.' : complete ? 'Линия завершена!' : `Ваш ход: ${state.side === 'w' ? 'белые' : 'чёрные'}.`}</p><p className="muted">Принимаются известные пути к выбранной позиции, включая транспозиции, без повторения позиций. Начните заново для повтора.</p></section>}
    <section className="card history"><div className="card-heading"><h2>История ходов</h2><span>{state.cursor} / {state.moves.length}</span></div><div className="nav"><button aria-label="В начало" disabled={!state.cursor} onClick={() => { setState(navigate(state,0)); clear(); }}>⏮</button><button aria-label="Назад" disabled={!state.cursor} onClick={() => { setState(navigate(state,state.cursor-1)); clear(); }}>←</button><button aria-label="Вперёд" disabled={state.cursor===state.moves.length} onClick={() => { setState(navigate(state,state.cursor+1)); clear(); }}>→</button><button aria-label="В конец" disabled={state.cursor===state.moves.length} onClick={() => { setState(navigate(state,state.moves.length)); clear(); }}>⏭</button></div><div className="moves">{state.moves.length ? state.moves.map((san,i) => <button key={i} className={state.cursor===i+1?'active':''} aria-label={`Позиция после ${i+1}: ${san}`} onClick={() => { setState(navigate(state,i+1)); clear(); }}><small>{i%2===0?`${i/2+1}.`:'…'}</small> {san}</button>) : <p className="muted">Первый ход — за вами.</p>}</div><button className="restart" onClick={() => { reset(); }}>↻ Начать заново</button></section>
    <section className="card analysis" aria-label="Дебютная позиция"><div className="eyebrow">ДЕБЮТНАЯ ВЫБОРКА</div><div data-testid="opening-names">{resolved.names.length ? resolved.names.map(o => <div key={o.id}><h3>{o.eco} {o.name}</h3>{!training && <button onClick={() => begin(o, true)}>Тренировать эту линию</button>}</div>) : <p>{resolved.next.size ? 'Позиция есть в выборке; точное именованное совпадение не достигнуто.' : 'Позиция вне тестовой выборки.'}</p>}</div><h3>Продолжения из выборки</h3><div className="continuations">{[...resolved.next.values()].map(edge => <button key={edge.uci} disabled={training} onClick={() => commitMove(edge.uci.slice(0,2) as Square, edge.uci.slice(2,4) as Square, edge.uci[4] as Promotion | undefined)}>{edge.san}</button>)}</div>{!resolved.next.size && <p className="muted">Известных продолжений нет. В исследовании можно играть дальше.</p>}<p className="muted">Только именованные линии CC0. Частоты, winrate и оценка движка не рассчитаны.</p><details><summary>Текущий FEN</summary><output data-testid="fen">{game.fen()}</output></details></section></aside></div>{catalogOpen && <OpeningCatalog onSelect={begin} />}</main>}
    <footer>CHESSOPENING LAB <span>Изучайте. Проверяйте. Играйте.</span></footer>
    </div>
    {promotion && <div className="modal-backdrop"><section ref={promotionDialogRef} role="dialog" aria-modal="true" aria-labelledby="promotion-title" className="modal"><h2 id="promotion-title">Превращение пешки</h2><p>Выберите фигуру</p><div className="promotion-options">{([['q','Ферзь'],['r','Ладья'],['b','Слон'],['n','Конь']] as const).map(([value,label]) => <button key={value} onClick={() => { commitMove(promotion.from,promotion.to,value as Promotion); setPromotion(null); }}>{label}</button>)}</div><button onClick={clear}>Отмена</button></section></div>}
  </div>;
}
