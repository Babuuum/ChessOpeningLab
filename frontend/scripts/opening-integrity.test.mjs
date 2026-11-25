import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { expect, it } from 'vitest';
import { verifySource } from './opening-integrity.mjs';

it('O01 verifies all pinned TSV and license bytes; rejects corruption and wrong Git blobs', async () => {
  const root = new URL('../data/chess-openings/', import.meta.url);
  const lock = JSON.parse(await readFile(new URL('source.lock.json', root), 'utf8'));
  for (const [name, expected] of Object.entries(lock.files)) {
    const data = await readFile(new URL(name, root));
    expect(() => verifySource(data, expected, name)).not.toThrow();
    const corrupt = new Uint8Array(data); corrupt[0] ^= 1;
    expect(() => verifySource(corrupt, expected, name)).toThrow('checksum mismatch');
    expect(() => verifySource(data, { ...expected, gitBlob: '0'.repeat(40) }, name)).toThrow('checksum mismatch');
    expect(createHash('sha256').update(data).digest('hex')).toBe(expected.sha256);
  }
});
