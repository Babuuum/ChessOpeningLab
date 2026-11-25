import { useState } from 'react';
import type { Opening } from './import';
import { catalog, openingIndex, source } from './catalog';
import { searchOpenings } from './model';

function notation(opening: Opening) {
  const keys = openingIndex.paths.get(opening.id)!;
  return opening.moves.map((uci, ply) => {
    const san = openingIndex.nodes.get(keys[ply])!.next.get(uci)!.san;
    return `${ply % 2 === 0 ? `${ply / 2 + 1}. ` : ''}${san}`;
  }).join(' ');
}

export function OpeningCatalog({ onSelect }: { onSelect: (opening: Opening, training: boolean) => void }) {
  const [query, setQuery] = useState('');
  const matches = catalog.map(entry => ({ ...entry, matches: searchOpenings(entry.variants, query) }))
    .filter(entry => entry.matches.length);
  return <section className="card catalog" aria-label="Каталог дебютов">
    <h2>Каталог дебютов</h2>
    <label>Поиск по названию или ECO<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <p className="muted" role="status">Найдено дебютов: {matches.length} из {catalog.length}. Выборка, не рейтинг популярности.</p>
    <div className="catalog-list">{matches.map(entry => <article key={entry.family} data-testid="catalog-entry">
      <h3>{entry.name}</h3><p><b>{entry.eco}</b> · Вариантов: {entry.variants.length}</p>
      <button onClick={() => onSelect(entry.variants[0], false)} aria-label={`Исследовать дебют ${entry.name}`}>Исследовать</button>{' '}
      <button onClick={() => onSelect(entry.variants[0], true)} aria-label={`Тренировать дебют ${entry.name}`}>Тренировать</button>
      <details open={!!query.trim()}><summary>Выбрать вариант ({entry.matches.length})</summary>
        {entry.matches.map(opening => <div key={opening.id} className="catalog-variant">
          <b>{opening.eco}</b> {opening.name}<small>{opening.moves.length} полуходов · {notation(opening)}</small>
          <button onClick={() => onSelect(opening, false)} aria-label={`Исследовать ${opening.eco} ${opening.name}`}>Исследовать вариант</button>{' '}
          <button onClick={() => onSelect(opening, true)} aria-label={`Тренировать ${opening.eco} ${opening.name}`}>Тренировать вариант</button>
        </div>)}
      </details>
    </article>)}</div>
    {!matches.length && <p>Совпадений нет. Попробуйте другое название или ECO.</p>}
    <p className="muted">Источник: <a href={source.repository}>lichess-org/chess-openings</a> · CC0-1.0. Названия сохранены на английском.</p>
  </section>;
}
