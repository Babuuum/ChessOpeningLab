import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { parseTsv, selectSample } from '../src/openings/import.ts';
import { verifySource } from './opening-integrity.mjs';

const root = new URL('../data/chess-openings/', import.meta.url);
const lock = JSON.parse(await readFile(new URL('source.lock.json', root), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(lock.commit) || lock.repository !== 'https://github.com/lichess-org/chess-openings' || lock.license !== 'CC0-1.0') {
  throw new Error('Invalid source lock');
}
const download = process.argv.includes('--download');
const check = process.argv.includes('--check');
if (download && check) throw new Error('Use --download or --check, not both');
const rows = [], rejected = [];
let duplicates = 0, total = 0;
// All files are verified before writing any downloaded source or generated output.
const sources = [];
for (const name of ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv', 'COPYING.txt']) {
  const expected = lock.files[name];
  const data = download
    ? await (async () => {
      const response = await globalThis.fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/${lock.commit}/${name}`, { signal: globalThis.AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    })()
    : await readFile(new URL(name, root));
  verifySource(data, expected, name);
  sources.push([name, data]);
  if (!name.endsWith('.tsv')) continue;
  const parsed = parseTsv(new globalThis.TextDecoder().decode(data), name);
  rows.push(...parsed.openings); rejected.push(...parsed.rejected);
  duplicates += parsed.duplicates; total += parsed.rows;
}
const openings = selectSample(rows);
const dataset = { version: 1, source: { repository: lock.repository, commit: lock.commit, license: lock.license }, openings };
const summary = { sourceRows: total, validRows: rows.length, duplicates, rejected, selected: openings.length,
  selection: '10 shortest lines per family, then ECO/name/UCI lexical order; not popularity' };
const outputs = [[new URL('../src/openings/data.json', import.meta.url), JSON.stringify(dataset) + '\n'],
  [new URL('import-report.json', root), JSON.stringify(summary, null, 2) + '\n']];
for (const [url, text] of outputs) {
  if (check) {
    if (await readFile(url, 'utf8') !== text) throw new Error(`Stale generated file: ${fileURLToPath(url)}`);
  } else await writeFile(url, text);
}
if (download) for (const [name, data] of sources) await writeFile(new URL(name, root), data);
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
