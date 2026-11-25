"""Offline regression checks; Docker is mocked, no containers or ports are used."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bundle', ROOT / 'release-bundle.py')
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)


class RuntimeGuardTests(unittest.TestCase):
    def test_absent_and_each_forbidden_tool(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            for tool in (None, 'node', 'npm'):
                if tool:
                    binary = path / tool
                    binary.write_text('#!/bin/sh\nexit 0\n')
                    binary.chmod(0o700)
                result = subprocess.run(['/bin/sh', str(ROOT / 'check-runtime-tools.sh')],
                                        env={'PATH': folder}, capture_output=True)
                self.assertEqual(result.returncode, 0 if tool is None else 1, tool)
                if tool:
                    binary.unlink()


class BundleTests(unittest.TestCase):
    def test_cross_host_bundle_and_tamper_rejection(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            evidence = root / 'acceptance.txt'
            evidence.write_text('Owner verified image smoke, runtime and recovery; test fixture\n')
            current_id = 'sha256:' + 'a' * 64

            def docker(*args):
                if args[:3] == ('docker', 'image', 'inspect'):
                    return json.dumps([{'Id': current_id, 'Os': 'linux', 'Architecture': 'amd64',
                                        'Config': {'Labels': {'org.opencontainers.image.revision': 'b' * 40}}}])
                self.assertEqual(args[:4], ('docker', 'image', 'save', '--output'))
                Path(args[4]).write_bytes(b'synthetic image archive')
                return ''

            with patch.object(bundle, 'run', side_effect=docker):
                previous = root / 'previous'
                bundle.package(current_id, evidence, previous)
                (previous / '.env.home').write_text('SECRET=must-not-travel')
                current_id = 'sha256:' + 'c' * 64
                candidate = root / 'candidate'
                bundle.package(current_id, evidence, candidate, previous)
                self.assertEqual(bundle.verify(candidate)['imageId'], current_id)
                self.assertEqual(bundle.verify(candidate / 'rollback')['imageId'], 'sha256:' + 'a' * 64)
                self.assertFalse((candidate / 'rollback' / '.env.home').exists())
                self.assertTrue((candidate / 'TRANSFER.sha256').exists())
                (candidate / 'rollback' / 'Caddyfile').write_text('corrupted')
                with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
                    bundle.verify(candidate / 'rollback')

    def test_missing_manifest_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(FileNotFoundError):
                bundle.verify(Path(folder))


if __name__ == '__main__':
    unittest.main()
