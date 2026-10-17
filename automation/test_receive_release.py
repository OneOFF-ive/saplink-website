import copy
import hashlib
import io
import json
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from receive_release import receive, release_manifest, prune_downloads


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.directory.name)
        self.payloads = {'x64': b'MZ-x64-fixture', 'arm64': b'MZ-arm64-fixture'}
        self.release = {'id': 101, 'tag_name': 'v1.2.3', 'published_at': '2026-01-01',
                        'draft': False, 'prerelease': False, 'assets': []}
        for arch, data in self.payloads.items():
            self.release['assets'].append({'name': f'SapLink-1.2.3-win-{arch}-setup.exe',
                'state': 'uploaded', 'size': len(data), 'digest': 'sha256:' + hashlib.sha256(data).hexdigest()})
        self.manifest = release_manifest(self.release)

    def tearDown(self):
        self.directory.cleanup()

    def archive(self, *, omit=None, tamper=None, extra=None, supplied=None):
        result = io.BytesIO()
        with tarfile.open(fileobj=result, mode='w') as archive:
            def add(name, data):
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
            add('releases.json', json.dumps(supplied or self.manifest).encode())
            for arch, data in self.payloads.items():
                if arch != omit:
                    if arch == tamper:
                        data = b'X' * len(data)
                    add(self.manifest['platforms'][arch]['filename'], data)
            if extra:
                add(extra, b'unsafe')
        result.seek(0)
        return result

    def apply(self, archive, latest=None):
        return receive(archive, self.root, lambda tag: self.release, latest or (lambda: self.release))

    def test_publish_and_idempotent_retry(self):
        for _ in range(2):
            result = self.apply(self.archive())
            self.assertEqual(result['version'], '1.2.3')
            for arch, data in self.payloads.items():
                self.assertEqual((self.root / 'latest' / f'SapLink-win-{arch}-setup.exe').read_bytes(), data)

    def test_missing_architecture_does_not_publish(self):
        with self.assertRaises(ValueError):
            self.apply(self.archive(omit='arm64'))
        self.assertFalse((self.root / 'latest').exists())
        self.assertFalse((self.root / 'v1.2.3').exists())

    def test_tamper_keeps_current_version(self):
        self.apply(self.archive())
        before = (self.root / 'latest').readlink()
        with self.assertRaises(ValueError):
            self.apply(self.archive(tamper='x64'))
        self.assertEqual((self.root / 'latest').readlink(), before)
        self.assertEqual((self.root / 'latest' / 'SapLink-win-x64-setup.exe').read_bytes(), self.payloads['x64'])

    def test_path_traversal_rejected(self):
        with self.assertRaises(ValueError):
            self.apply(self.archive(extra='../outside'))
        self.assertFalse((self.root / 'latest').exists())

    def test_unofficial_digest_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest['platforms']['x64']['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            self.apply(self.archive(supplied=manifest))

    def test_newer_release_during_upload_rejected(self):
        calls = 0
        def latest():
            nonlocal calls
            calls += 1
            return self.release if calls == 1 else {**self.release, 'id': 102}
        with self.assertRaises(ValueError):
            self.apply(self.archive(), latest)
        self.assertFalse((self.root / 'latest').exists())

    def test_downgrade_rejected(self):
        newer = self.root / 'v2.0.0'
        newer.mkdir()
        (newer / 'releases.json').write_text(json.dumps({'version': '2.0.0'}))
        (self.root / 'latest').symlink_to('v2.0.0')
        with self.assertRaises(ValueError):
            self.apply(self.archive())
        self.assertEqual((self.root / 'latest').readlink(), pathlib.Path('v2.0.0'))

    def test_prerelease_rejected(self):
        with self.assertRaises(ValueError):
            release_manifest({**self.release, 'prerelease': True})

    def seed_previous_version(self):
        previous = self.root / 'v1.0.0'
        previous.mkdir()
        (previous / 'previous.exe').write_bytes(b'previous installer')
        (previous / 'releases.json').write_text(json.dumps({'version': '1.0.0'}))
        (self.root / 'latest').symlink_to('v1.0.0')
        return previous

    def test_success_removes_previous_version_and_abandoned_upload(self):
        previous = self.seed_previous_version()
        abandoned = self.root / '.incoming-obsolete'
        abandoned.mkdir()
        (abandoned / 'partial.exe').write_bytes(b'partial installer')
        result = self.apply(self.archive())
        self.assertEqual(set(result['removed']), {'v1.0.0', '.incoming-obsolete'})
        self.assertFalse(previous.exists())
        self.assertFalse(abandoned.exists())
        self.assertEqual((self.root / 'latest').readlink(), pathlib.Path('v1.2.3'))
        self.assertTrue((self.root / 'latest' / self.manifest['platforms']['x64']['filename']).is_file())

    def test_failed_upload_preserves_previous_version(self):
        previous = self.seed_previous_version()
        with self.assertRaises(ValueError):
            self.apply(self.archive(tamper='arm64'))
        self.assertTrue(previous.is_dir())
        self.assertEqual((self.root / 'latest').readlink(), pathlib.Path('v1.0.0'))

    def test_cleanup_does_not_follow_symlinks_or_remove_unknown_directories(self):
        with tempfile.TemporaryDirectory() as external:
            outside = pathlib.Path(external)
            (outside / 'keep.txt').write_text('keep')
            (self.root / 'v0.9.0').symlink_to(outside)
            unknown = self.root / 'unrelated'
            unknown.mkdir()
            self.apply(self.archive())
            self.assertTrue((outside / 'keep.txt').exists())
            self.assertTrue((self.root / 'v0.9.0').is_symlink())
            self.assertTrue(unknown.is_dir())

    def test_cleanup_rejects_latest_outside_downloads(self):
        previous = self.seed_previous_version()
        (self.root / 'latest').unlink()
        with tempfile.TemporaryDirectory() as external:
            (self.root / 'latest').symlink_to(external)
            with self.assertRaises(ValueError):
                prune_downloads(self.root)
            self.assertTrue(previous.exists())

    def test_cleanup_failure_keeps_new_downloads_active_and_reports_failure(self):
        self.seed_previous_version()
        with patch('receive_release.prune_downloads', side_effect=PermissionError('cleanup denied')):
            with self.assertRaisesRegex(RuntimeError, 'New release is active'):
                self.apply(self.archive())
        self.assertEqual((self.root / 'latest').readlink(), pathlib.Path('v1.2.3'))
        self.assertTrue((self.root / 'v1.0.0').exists())
        self.apply(self.archive())
        self.assertFalse((self.root / 'v1.0.0').exists())

    def test_metadata_only_retry_requires_verified_existing_files(self):
        def metadata_only():
            data = io.BytesIO()
            encoded = json.dumps(self.manifest).encode()
            with tarfile.open(fileobj=data, mode='w') as archive:
                member = tarfile.TarInfo('releases.json')
                member.size = len(encoded)
                archive.addfile(member, io.BytesIO(encoded))
            data.seek(0)
            return data
        with self.assertRaises(ValueError):
            self.apply(metadata_only())
        self.apply(self.archive())
        self.assertEqual(self.apply(metadata_only())['version'], '1.2.3')
        (self.root / 'v1.2.3' / self.manifest['platforms']['x64']['filename']).write_bytes(b'tampered')
        with self.assertRaises(ValueError):
            self.apply(metadata_only())


if __name__ == '__main__':
    unittest.main()
