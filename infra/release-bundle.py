#!/usr/bin/env python3
"""Package immutable images/configuration; never deploy or copy environment files."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

FILES = ('image.tar', 'image-inspect.json', 'metadata.json', 'compose.home.yaml',
         'Caddyfile', 'Dockerfile', 'env.home.example', 'check-runtime-tools.sh', 'VERIFIED.txt')


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def verify(directory):
    expected = set(FILES)
    manifest = directory / 'SHA256SUMS'
    lines = manifest.read_text().splitlines()
    if len(lines) != len(expected):
        raise ValueError('Incomplete bundle manifest')
    for line in lines:
        digest, name = line.split('  ', 1)
        if name not in expected or not re.fullmatch(r'[a-f0-9]{64}', digest):
            raise ValueError('Invalid manifest entry')
        expected.remove(name)
        if sha(directory / name) != digest:
            raise ValueError(f'Checksum mismatch: {name}')
    if not (directory / 'VERIFIED.txt').read_text().strip():
        raise ValueError('Missing acceptance evidence')
    metadata = json.loads((directory / 'metadata.json').read_text())
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', metadata['imageId']):
        raise ValueError('Invalid image ID')
    if not re.fullmatch(r'[a-f0-9]{40}', metadata['revision']):
        raise ValueError('Invalid revision')
    return metadata


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def package(image, evidence, output, previous=None):
    # Evidence is owner/reviewer supplied after real image acceptance, never fabricated.
    if not evidence.read_text().strip():
        raise ValueError('Supply nonempty runtime acceptance evidence')
    previous_metadata = verify(previous) if previous else None
    inspection = json.loads(run('docker', 'image', 'inspect', image))[0]
    revision = inspection['Config']['Labels']['org.opencontainers.image.revision']
    metadata = {'version': '0.1.0', 'imageId': inspection['Id'], 'revision': revision,
                'platform': inspection['Os'] + '/' + inspection['Architecture'],
                'rollback': previous_metadata, 'baseImages': {key: inspection['Config']['Labels'].get(key)
                    for key in ('lab.node-base', 'lab.caddy-base')}}
    if previous_metadata and previous_metadata['platform'] != metadata['platform']:
        raise ValueError('Rollback platform differs')
    if previous_metadata and previous_metadata['imageId'] == metadata['imageId']:
        raise ValueError('Rollback must be a distinct verified image')
    # Refuse overwrites; interrupted output must not be deployed.
    output.mkdir(parents=True, exist_ok=False)
    root = Path(__file__).resolve().parent.parent
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (output / 'image-inspect.json').write_text(json.dumps(inspection, indent=2) + '\n')
    shutil.copyfile(evidence, output / 'VERIFIED.txt')
    for name in ('compose.home.yaml', 'Caddyfile', 'env.home.example', 'check-runtime-tools.sh'):
        shutil.copyfile(root / 'infra' / name, output / name)
    shutil.copyfile(root / 'Dockerfile', output / 'Dockerfile')
    run('docker', 'image', 'save', '--output', str(output / 'image.tar'), image)
    (output / 'SHA256SUMS').write_text(''.join(f'{sha(output / name)}  {name}\n' for name in FILES))
    verify(output)
    if previous:
        (output / 'rollback').mkdir()
        for name in (*FILES, 'SHA256SUMS'):
            shutil.copyfile(previous / name, output / 'rollback' / name)
        verify(output / 'rollback')
    shutil.copyfile(Path(__file__), output / 'release-bundle.py')
    # Outer checksum covers both sub-bundles and verifier; no env/secrets copied.
    paths = sorted(p for p in output.rglob('*') if p.is_file())
    (output / 'TRANSFER.sha256').write_text(''.join(
        f'{sha(p)}  {p.relative_to(output).as_posix()}\n' for p in paths))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    check = sub.add_parser('verify')
    check.add_argument('directory', type=Path)
    pack = sub.add_parser('pack')
    pack.add_argument('--image', required=True, help='Verified immutable image ID')
    pack.add_argument('--evidence', type=Path, required=True)
    pack.add_argument('--output', type=Path, required=True)
    group = pack.add_mutually_exclusive_group(required=True)
    group.add_argument('--previous', type=Path, help='Previous verified bundle')
    group.add_argument('--first-release', action='store_true', help='No rollback image exists yet')
    args = parser.parse_args()
    if args.command == 'verify':
        print(json.dumps(verify(args.directory), indent=2))
    else:
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', args.image):
            parser.error('--image must be an immutable image ID')
        root = Path(__file__).resolve().parent.parent
        if run('git', '-C', str(root), 'status', '--porcelain', '--untracked-files=all'):
            parser.error('Package only from the clean accepted checkout')
        inspection = json.loads(run('docker', 'image', 'inspect', args.image))[0]
        revision = inspection['Config']['Labels']['org.opencontainers.image.revision']
        if run('git', '-C', str(root), 'rev-parse', 'HEAD') != revision:
            parser.error('Image revision differs from checkout configuration')
        package(args.image, args.evidence, args.output, args.previous)
