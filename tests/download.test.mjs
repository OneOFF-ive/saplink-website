import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const original = readFileSync(new URL('../dist/download.js', import.meta.url), 'utf8');
const script = original.replace(/prepareDownload\(\);\s*$/, 'globalThis.completion = prepareDownload();');
assert.notEqual(script, original, 'The download page must expose one startup call for the browser harness.');

function releaseFixture(version = '2.3.4') {
  return {
    version,
    platforms: Object.fromEntries(['x64', 'arm64'].map(architecture => {
      const filename = `SapLink-${version}-win-${architecture}-setup.exe`;
      return [architecture, {
        filename, url: `downloads/v${version}/${filename}`,
        size: architecture === 'x64' ? 100 : 80, sha256: 'a'.repeat(64),
      }];
    })),
  };
}

async function openPage(architecture, mode = 'success', version) {
  const release = releaseFixture(version);
  if (mode === 'external-url') release.platforms[architecture].url = 'https://example.org/installer.exe';
  if (mode === 'wrong-architecture') release.platforms[architecture] = release.platforms[architecture === 'x64' ? 'arm64' : 'x64'];
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      textContent: '', hidden: false, clicks: 0, handlers: {},
      setAttribute() {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      click() { this.clicks++; this.handlers.click?.(); },
    });
    return nodes.get(id);
  }
  const requests = [];
  const context = vm.createContext({
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    location: { search: '?arch=' + architecture, origin: 'https://example.test' },
    document: { baseURI: 'https://example.test/', getElementById: node, querySelector: node },
    fetch: async (url, options) => {
      requests.push(String(url));
      if (mode === 'network-error') throw new Error('Offline');
      if (String(url) === 'downloads/latest/releases.json') {
        assert.equal(options.cache, 'no-store');
        return {
          ok: mode !== 'metadata-missing',
          json: async () => {
            if (mode === 'invalid-json') throw new SyntaxError('Invalid JSON');
            return structuredClone(release);
          },
        };
      }
      assert.equal(options.method, 'HEAD');
      return {
        ok: mode !== 'missing',
        headers: { get: () => String(mode === 'wrong-size' ? 1 : release.platforms[architecture].size) },
      };
    },
  });
  vm.runInContext(script, context);
  await context.completion;
  return { node, requests, release };
}

for (const architecture of ['x64', 'arm64']) {
  test(`${architecture}: starts one download matching the selected architecture`, async () => {
    const { node, release } = await openPage(architecture);
    const manual = node('manual-download');
    assert.equal(manual.clicks, 1);
    assert.equal(manual.download, release.platforms[architecture].filename);
    assert.equal(manual.href, 'https://example.test/' + release.platforms[architecture].url);
    assert.equal(node('download-title').textContent, '下载已发起');
  });

  test(`${architecture}: follows a newer version without page changes`, async () => {
    const { node } = await openPage(architecture, 'success', '7.8.9');
    assert.equal(node('manual-download').download, `SapLink-7.8.9-win-${architecture}-setup.exe`);
    assert.equal(node('installer-version').textContent, 'v7.8.9');
  });
}

test('unsupported architecture does not request metadata or start a download', async () => {
  const { node, requests } = await openPage('unsupported');
  assert.equal(requests.length, 0);
  assert.equal(node('manual-download').clicks, 0);
  assert.equal(node('download-fallback').hidden, true);
});

for (const [architecture, mode] of [
  ['x64', 'missing'], ['arm64', 'wrong-size'], ['arm64', 'network-error'],
  ['x64', 'metadata-missing'], ['arm64', 'invalid-json'],
  ['x64', 'external-url'], ['x64', 'wrong-architecture'],
]) {
  test(`${mode}: restores the ${architecture} stable fallback without starting a download`, async () => {
    const { node } = await openPage(architecture, mode);
    const manual = node('manual-download');
    assert.equal(manual.clicks, 0);
    assert.equal(manual.hidden, false);
    assert.equal(manual.href, `https://example.test/downloads/latest/SapLink-win-${architecture}-setup.exe`);
    assert.equal(manual.download, '');
    assert.equal(node('download-title').textContent, '暂时无法自动下载');
    assert.equal(node('installer-summary').hidden, true);
    assert.equal(node('installer-filename').textContent, '');
  });
}

test('manual retry retains the verified installer and updates the status', async () => {
  const { node } = await openPage('arm64');
  const manual = node('manual-download');
  const verified = manual.href;
  manual.click();
  assert.equal(manual.clicks, 2);
  assert.equal(manual.href, verified);
  assert.equal(node('download-status').textContent, '已重新请求下载，请查看浏览器的下载列表。');
});
