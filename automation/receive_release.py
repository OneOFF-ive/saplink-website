"""Receive only verified, official SapLink installers over a forced SSH command."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import shutil
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

REPOSITORY = 'OneOFF-ive/saplink'
DOWNLOADS = Path('/srv/saplink-website/downloads')
VERSION = re.compile(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')
MAX_INSTALLER = 256 * 1024 * 1024


def api(endpoint):
    request = urllib.request.Request(
        f'https://api.github.com/repos/{REPOSITORY}/{endpoint}',
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'SapLink-Release-Sync'},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.load(response)
        except (OSError, ValueError):
            if attempt == 2:
                raise RuntimeError('Unable to verify the official GitHub release') from None
            time.sleep(2 ** attempt)


def release_manifest(release):
    tag = release.get('tag_name', '')
    if not isinstance(tag, str) or not tag.startswith('v') or not VERSION.fullmatch(tag[1:]):
        raise ValueError('Expected a stable vMAJOR.MINOR.PATCH release')
    if release.get('draft') or release.get('prerelease') or not release.get('published_at'):
        raise ValueError('Only published stable releases are accepted')
    version = tag[1:]
    platforms = {}
    for architecture in ('x64', 'arm64'):
        name = f'SapLink-{version}-win-{architecture}-setup.exe'
        matches = [asset for asset in release.get('assets', []) if asset.get('name') == name]
        if len(matches) != 1:
            raise ValueError('Missing or duplicate official installer: ' + name)
        asset = matches[0]
        digest = asset.get('digest', '')
        size = asset.get('size')
        if not isinstance(digest, str) or not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
            raise ValueError('Official SHA-256 is unavailable: ' + name)
        if type(size) is not int or not 0 < size <= MAX_INSTALLER or asset.get('state') != 'uploaded':
            raise ValueError('Invalid official installer size or upload state')
        platforms[architecture] = {
            'name': 'Windows ' + ('ARM64' if architecture == 'arm64' else 'x64'),
            'filename': name, 'url': f'downloads/{tag}/{name}',
            'size': size, 'sha256': digest[7:],
        }
    return {'version': version, 'release_id': release['id'], 'platforms': platforms}


def verify_file(path, asset):
    if path.is_symlink() or not path.is_file() or path.stat().st_size != asset['size']:
        raise ValueError('Installer file is missing or has changed')
    with path.open('rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != asset['sha256']:
            raise ValueError('Installer checksum does not match the official release')


def prune_downloads(downloads):
    """Keep the validated active version only. Caller must hold the synchronization lock."""
    root = Path(downloads).resolve(strict=True)
    latest = root / 'latest'
    if not latest.is_symlink():
        raise ValueError('Latest must be a version pointer before cleanup')
    active = latest.resolve(strict=True)
    if active.parent != root or not active.is_dir() or not active.name.startswith('v') or not VERSION.fullmatch(active.name[1:]):
        raise ValueError('Latest does not point to a managed version directory')
    manifest = json.loads((active / 'releases.json').read_text())
    version = manifest.get('version')
    if version != active.name[1:]:
        raise ValueError('Active version and manifest disagree; cleanup cancelled')
    for architecture in ('x64', 'arm64'):
        asset = manifest['platforms'][architecture]
        name = f'SapLink-{version}-win-{architecture}-setup.exe'
        if asset.get('filename') != name:
            raise ValueError('Unexpected active installer name; cleanup cancelled')
        verify_file(active / name, asset)

    removed = []
    for candidate in sorted(root.iterdir()):
        managed_version = candidate.name.startswith('v') and VERSION.fullmatch(candidate.name[1:])
        abandoned_upload = candidate.name.startswith(('.incoming-', '.metadata-'))
        if not (managed_version or abandoned_upload) or candidate.is_symlink() or not candidate.is_dir():
            continue
        resolved = candidate.resolve(strict=True)
        if resolved == active:
            continue
        if resolved.parent != root or latest.resolve(strict=True) != active:
            raise ValueError('Cleanup target or active version changed; cleanup cancelled')
        shutil.rmtree(candidate)
        removed.append(candidate.name)
    return removed


def receive(stream, downloads, get_release, get_latest):
    downloads = Path(downloads)
    with tarfile.open(fileobj=stream, mode='r|') as archive:
        first = archive.next()
        if first is None or first.name != 'releases.json' or not first.isfile() or not 0 < first.size <= 16384:
            raise ValueError('The first archive entry must be the release manifest')
        supplied = json.load(archive.extractfile(first))
        version = supplied.get('version', '')
        if not isinstance(version, str) or not VERSION.fullmatch(version):
            raise ValueError('Invalid release version')
        official = get_release('v' + version)
        manifest = release_manifest(official)
        if supplied != manifest:
            raise ValueError('Uploaded manifest differs from official GitHub metadata')
        latest = get_latest()
        if latest.get('id') != official['id'] or latest.get('tag_name') != 'v' + version:
            raise ValueError('Only the latest official release may be promoted')
        current_path = downloads / 'latest' / 'releases.json'
        if current_path.exists():
            current = json.loads(current_path.read_text())
            current_version = current.get('version', '')
            if not isinstance(current_version, str) or not VERSION.fullmatch(current_version):
                raise ValueError('Current version requires administrator review')
            if tuple(map(int, version.split('.'))) < tuple(map(int, current_version.split('.'))):
                raise ValueError('Automatic downgrades are not allowed')
        expected = {asset['filename']: asset for asset in manifest['platforms'].values()}
        received = set()
        with tempfile.TemporaryDirectory(prefix='.incoming-', dir=downloads) as temporary:
            work = Path(temporary)
            # archive.next() consumed the manifest; iterate with next() explicitly.
            while member := archive.next():
                if not member.isfile() or member.name not in expected or member.name in received:
                    raise ValueError('Unexpected, duplicate, or unsafe archive entry')
                asset = expected[member.name]
                if member.size != asset['size']:
                    raise ValueError('Installer size differs from official metadata')
                source = archive.extractfile(member)
                digest = hashlib.sha256()
                written = 0
                target = work / member.name
                with target.open('xb') as output:
                    while chunk := source.read(1024 * 1024):
                        written += len(chunk)
                        if written > asset['size']:
                            raise ValueError('Installer exceeds the allowed size')
                        output.write(chunk)
                        digest.update(chunk)
                if written != asset['size'] or digest.hexdigest() != asset['sha256']:
                    raise ValueError('Installer checksum verification failed')
                target.chmod(0o644)
                received.add(member.name)
            if received != set(expected):
                # A metadata-only retry is valid only if both official files already exist.
                existing = downloads / ('v' + version)
                if received or existing.is_symlink() or not existing.is_dir():
                    raise ValueError('Both installer architectures must be uploaded together')
                for asset in expected.values():
                    verify_file(existing / asset['filename'], asset)
            # Recheck after transfer so a superseded workflow cannot publish late.
            latest = get_latest()
            if latest.get('id') != official['id'] or latest.get('tag_name') != 'v' + version:
                raise ValueError('A newer release was published during this transfer')
            destination = downloads / ('v' + version)
            if destination.exists() or destination.is_symlink():
                if destination.is_symlink() or not destination.is_dir():
                    raise ValueError('Existing version directory requires administrator review')
                for asset in expected.values():
                    verify_file(destination / asset['filename'], asset)
                # Existing verified releases remain immutable; repair only metadata/aliases.
                published = destination
            else:
                work.chmod(0o755)
                for architecture, asset in manifest['platforms'].items():
                    (work / f'SapLink-win-{architecture}-setup.exe').symlink_to(asset['filename'])
                (work / 'releases.json').write_text(json.dumps(manifest, indent=2) + '\n')
                (work / 'releases.json').chmod(0o644)
                os.rename(work, destination)
                published = destination

        # Metadata and stable names are prepared before replacing the one latest pointer.
        with tempfile.TemporaryDirectory(prefix='.metadata-', dir=downloads) as temporary:
            work = Path(temporary)
            for architecture, asset in manifest['platforms'].items():
                name = f'SapLink-win-{architecture}-setup.exe'
                (work / name).symlink_to(asset['filename'])
                os.replace(work / name, published / name)
            (work / 'releases.json').write_text(json.dumps(manifest, indent=2) + '\n')
            (work / 'releases.json').chmod(0o644)
            os.replace(work / 'releases.json', published / 'releases.json')
            (work / 'latest').symlink_to('v' + version)
            os.replace(work / 'latest', downloads / 'latest')
        try:
            removed = prune_downloads(downloads)
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise RuntimeError('New release is active, but obsolete installer cleanup failed; retry synchronization') from error
        return {'status': 'synced', 'version': version, 'release_id': official['id'], 'removed': removed}


def main():
    # Dispatch bounded uploads; retain the original check/sync/status protocol.
    if os.environ.get('SSH_ORIGINAL_COMMAND', '').split(' ', 1)[0] in {'prepare', 'chunk', 'promote', 'skill'}:
        from website_upload_receiver import handle
        handle(os.environ['SSH_ORIGINAL_COMMAND'], sys.modules[__name__])
        return
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    if command == 'status':
        manifest = json.loads((DOWNLOADS / 'latest' / 'releases.json').read_text())
        print(json.dumps({'version': manifest['version'], 'release_id': manifest.get('release_id')}))
        return
    if command == 'check':
        content = sys.stdin.buffer.read(16385)
        if len(content) > 16384:
            raise ValueError('Manifest is too large')
        supplied = json.loads(content)
        version = supplied.get('version', '')
        if not isinstance(version, str) or not VERSION.fullmatch(version):
            raise ValueError('Invalid release version')
        manifest = release_manifest(api('releases/tags/v' + version))
        if supplied != manifest:
            raise ValueError('Manifest differs from official GitHub metadata')
        latest = api('releases/latest')
        if latest.get('id') != manifest['release_id']:
            raise ValueError('Only the latest official release may be promoted')
        destination = DOWNLOADS / ('v' + version)
        available = destination.is_dir() and not destination.is_symlink()
        if available:
            for asset in manifest['platforms'].values():
                verify_file(destination / asset['filename'], asset)
        print(json.dumps({'need_upload': not available}), flush=True)
        return
    if command != 'sync':
        raise ValueError('Only check, sync, and status commands are permitted')
    def interrupted(signum, frame):
        raise RuntimeError('Synchronization interrupted or exceeded the time limit')
    for name in (signal.SIGTERM, signal.SIGHUP, signal.SIGALRM):
        signal.signal(name, interrupted)
    # A cancelled or disconnected runner must not retain the synchronization lock indefinitely.
    signal.alarm(18 * 60)
    with Path('/var/lib/saplink-release-sync/sync.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        result = receive(sys.stdin.buffer, DOWNLOADS,
                         lambda tag: api('releases/tags/' + tag),
                         lambda: api('releases/latest'))
        print(json.dumps(result), flush=True)
    signal.alarm(0)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Release synchronization failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
