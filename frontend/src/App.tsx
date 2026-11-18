import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import { candidates, createGame, navigate, play, position, preview, restart, status, type Promotion } from './chess/core';

export default function App() {
  const [mode, setMode] = useState<'home' | 'explore' | 'training'>('home');
  const [state, setState] = useState(() => createGame());
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const promotionDialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const game = position(state);
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
  function attempt(from: Square, to: Square) {
    if (promotion || game.isGameOver()) return false;
    const options = candidates(state, from, to);
    if (options.some(m => m.promotion)) {
      // Capture before the background becomes inert. A piece node may be
      // replaced/reused on promotion, so board interactions return to the board.
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement && active !== document.body && !boardRef.current?.contains(active) ? active : boardRef.current;
      setPromotion({ from, to });
      return false;
    }
    const next = play(state, from, to);
    if (next === state) { setNotice('Ход недоступен. Соблюдайте очередь и правила.'); return false; }
    setState(next); clear(); return true;
  }
  function select(square: Square) {
    if (promotion) return;
    if (selected && selected !== square && attempt(selected, square)) return;
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
    {mode === 'home' ? <main className="home"><div className="eyebrow">ОТ ПЕРВОГО ХОДА К ПОНИМАНИЮ</div><h1>Каждый ход —<br/><em>новая возможность.</em></h1><p>Исследуйте позиции и проверяйте идеи на интерактивной доске.</p><div className="mode-grid"><button className="mode-card" onClick={() => setMode('explore')}><span>01 / СВОБОДНАЯ ДОСКА</span><h2>Исследовать ↗</h2><p>Легальные ходы, варианты и история партии.</p></button><button className="mode-card secondary" onClick={() => setMode('training')}><span>02 / СКОРО</span><h2>Тренировать ↗</h2><p>Отработка дебютных линий появится позже.</p></button></div></main>
    : mode === 'training' ? <main className="home"><div className="eyebrow">В РАЗРАБОТКЕ</div><h1>Тренировка дебютов</h1><p>Это placeholder. Каталог, дебютное дерево и ответы компьютера ещё не подключены.</p><button className="primary" onClick={() => setMode('explore')}>Перейти к исследованию</button></main>
    : <main><div className="page-title"><div><div className="eyebrow">СВОБОДНАЯ ДОСКА</div><h1>Исследование</h1></div><button onClick={() => { clear(); setMode('training'); }}>Тренировка ↗</button></div><div className="workspace"><section className="board-panel" aria-label="Шахматная доска"><div className="board-top"><span>◉ {state.side === 'w' ? 'Чёрные' : 'Белые'}</span><span>Исследуйте обе стороны</span></div><div className="board" data-testid="board" ref={boardRef} tabIndex={-1}><Chessboard options={{id:'explore-board', position:game.fen(), boardOrientation:state.side === 'w' ? 'white' : 'black', squareStyles,
      darkSquareStyle:{backgroundColor:'#6b8b7f'}, lightSquareStyle:{backgroundColor:'#ebeee3'},
      onSquareClick:({square}) => select(square as Square),
      canDragPiece:({square}) => !promotion && !game.isGameOver() && game.get(square as Square)?.color === game.turn(),
      onPieceDrag:({square}) => { setSelected(square as Square); setNotice(''); },
      onPieceDrop:({sourceSquare,targetSquare}) => targetSquare ? attempt(sourceSquare as Square,targetSquare as Square) : false,
    }}/></div><div className="board-top"><span>◉ {state.side === 'w' ? 'Белые' : 'Чёрные'}</span><span>Ваша сторона</span></div><div className="legend"><span>🔵 ● Союзные</span><span>🔴 × Соперник</span><span>◯ Взятие</span></div></section>
    <aside><section className="card"><div className="eyebrow">ПОЗИЦИЯ</div><h2 role="status" aria-label="Статус партии" data-testid="game-status">{status(game)}</h2><label className="side-label">Ваша сторона<select aria-label="Ваша сторона" value={state.side} onChange={e => { setState(restart(state,e.target.value as 'w'|'b')); clear(); }}><option value="w">Белые</option><option value="b">Чёрные</option></select></label><p className="muted">Смена стороны начинает новую партию.</p><div className="hint" data-testid="preview-info">{hints ? `${hints.color === 'blue' ? 'Синие ● — союзная фигура.' : 'Красные × — фигура соперника.'} ${hints.hypothetical ? 'Предварительный просмотр при условной передаче хода. Это не прогноз и не карта атак.' : 'Легальные ходы текущей стороны.'}` : 'Выберите фигуру, чтобы увидеть доступные ходы. Играйте за обе стороны по очереди.'}</div>{notice && <p role="alert">{notice}</p>}</section>
    <section className="card history"><div className="card-heading"><h2>История ходов</h2><span>{state.cursor} / {state.moves.length}</span></div><div className="nav"><button aria-label="В начало" disabled={!state.cursor} onClick={() => { setState(navigate(state,0)); clear(); }}>⏮</button><button aria-label="Назад" disabled={!state.cursor} onClick={() => { setState(navigate(state,state.cursor-1)); clear(); }}>←</button><button aria-label="Вперёд" disabled={state.cursor===state.moves.length} onClick={() => { setState(navigate(state,state.cursor+1)); clear(); }}>→</button><button aria-label="В конец" disabled={state.cursor===state.moves.length} onClick={() => { setState(navigate(state,state.moves.length)); clear(); }}>⏭</button></div><div className="moves">{state.moves.length ? state.moves.map((san,i) => <button key={i} className={state.cursor===i+1?'active':''} aria-label={`Позиция после ${i+1}: ${san}`} onClick={() => { setState(navigate(state,i+1)); clear(); }}><small>{i%2===0?`${i/2+1}.`:'…'}</small> {san}</button>) : <p className="muted">Первый ход — за вами.</p>}</div><button className="restart" onClick={() => { setState(restart(state)); clear(); }}>↻ Начать заново</button></section>
    <section className="card analysis"><div className="eyebrow">АНАЛИЗ</div><h3>Не проанализировано</h3><p className="muted">База дебютов и серверная оценка будут доступны на следующих этапах.</p><details><summary>Текущий FEN</summary><output data-testid="fen">{game.fen()}</output></details></section></aside></div></main>}
    <footer>CHESSOPENING LAB <span>Изучайте. Проверяйте. Играйте.</span></footer>
    </div>
    {promotion && <div className="modal-backdrop"><section ref={promotionDialogRef} role="dialog" aria-modal="true" aria-labelledby="promotion-title" className="modal"><h2 id="promotion-title">Превращение пешки</h2><p>Выберите фигуру</p><div className="promotion-options">{([['q','Ферзь'],['r','Ладья'],['b','Слон'],['n','Конь']] as const).map(([value,label]) => <button key={value} onClick={() => { setState(play(state,promotion.from,promotion.to,value as Promotion)); clear(); }}>{label}</button>)}</div><button onClick={clear}>Отмена</button></section></div>}
  </div>;
}
