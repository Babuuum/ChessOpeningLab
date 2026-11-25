import { createHash } from 'node:crypto';

export function verifySource(data, expected, name) {
  if (!expected || data.length !== expected.bytes || createHash('sha256').update(data).digest('hex') !== expected.sha256 ||
      createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') !== expected.gitBlob) {
    throw new Error(`${name}: source checksum mismatch`);
  }
}
