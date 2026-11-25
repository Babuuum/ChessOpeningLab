import { Chess } from 'chess.js';

export interface Opening { id: string; eco: string; name: string; moves: string[] }
export const families = ['English Opening', 'Sicilian Defense', 'French Defense',
  'Caro-Kann Defense', 'Ruy Lopez', 'Italian Game', "Queen's Gambit Declined",
  'Slav Defense', "King's Indian Defense", 'Scandinavian Defense'];
export const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Fail closed: headers, custom starting positions, empty and illegal lines are rejected. */
export function parseTsv(text: string, file = 'input.tsv') {
  const rows = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  if (rows.shift() !== 'eco\tname\tpgn') throw new Error(`${file}: invalid TSV header`);
  const openings: Omit<Opening, 'id'>[] = [];
  const rejected: { file: string; row: number; reason: string }[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  rows.forEach((row, index) => {
    try {
      const cells = row.split('\t');
      const [eco, name, pgn] = cells;
      if (cells.length !== 3 || !/^[A-E]\d{2}$/.test(eco) || !name?.trim() || !pgn?.trim() || /[[\]{}();]/.test(pgn)) {
        throw new Error('invalid row or non-mainline PGN');
      }
      const game = new Chess();
      game.loadPgn(pgn, { strict: true });
      const moves = game.history({ verbose: true }).map(m => m.from + m.to + (m.promotion ?? ''));
      if (!moves.length) throw new Error('empty line');
      const key = JSON.stringify([eco, name, moves]);
      if (seen.has(key)) { duplicates++; return; }
      seen.add(key);
      openings.push({ eco, name, moves });
    } catch (error) {
      rejected.push({ file, row: index + 2, reason: error instanceof Error ? error.message : 'invalid PGN' });
    }
  });
  return { openings, rejected, duplicates, rows: rows.length };
}

/** Shortest lines first per family; lexical tie-breaks, no popularity inference. */
export function selectSample(rows: Omit<Opening, 'id'>[], perFamily = 10): Opening[] {
  const unique = [...new Map(rows.map(row => [JSON.stringify([row.eco, row.name, row.moves]), row])).values()];
  const selected = families.flatMap(family => {
    const matches = unique.filter(row => row.name.split(':')[0] === family).sort((a, b) =>
      a.moves.length - b.moves.length || compare(a.eco, b.eco) || compare(a.name, b.name) || compare(a.moves.join(' '), b.moves.join(' ')));
    if (matches.length < perFamily) throw new Error(`Not enough lines: ${family}`);
    return matches.slice(0, perFamily);
  });
  return selected.map((row, index) => ({ id: `opening-${String(index + 1).padStart(3, '0')}`, ...row }));
}
