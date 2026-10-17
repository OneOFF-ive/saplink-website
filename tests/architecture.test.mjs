import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/architecture.js', import.meta.url), 'utf8');
async function detect(navigator) {
  const link = { href: 'download.html?arch=auto' };
  const context = vm.createContext({
    navigator, setTimeout, clearTimeout,
    document: { querySelectorAll: () => [link] },
  });
  vm.runInContext(source, context);
  const architecture = await vm.runInContext('architectureDetection', context);
  return { architecture, href: link.href };
}

for (const [cpu, expected] of [['arm', 'arm64'], ['x86', 'x64']]) {
  test(`Windows ${cpu}: uses native hints despite a reduced x64 user agent`, async () => {
    const result = await detect({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      userAgentData: { platform: 'Windows', getHighEntropyValues: async () => ({ architecture: cpu, bitness: '64' }) },
    });
    assert.equal(result.architecture, expected);
    assert.equal(result.href, `download.html?arch=${expected}`);
  });
}

test('ambiguous x64 user agent keeps the manual architecture choice', async () => {
  const result = await detect({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
  assert.equal(result.architecture, null);
  assert.equal(result.href, 'download.html?arch=auto');
});
test('explicit legacy Windows ARM64 marker is recognized', async () => {
  assert.equal((await detect({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; ARM64)' })).architecture, 'arm64');
});
test('denied hints fall back to selection', async () => {
  assert.equal((await detect({ userAgentData: { platform: 'Windows', getHighEntropyValues: async () => { throw new Error('Denied'); } } })).architecture, null);
});
test('non-Windows devices do not get an automatically chosen Windows package', async () => {
  assert.equal((await detect({ userAgentData: { platform: 'macOS' } })).architecture, null);
});
test('32-bit Windows does not get a 64-bit installer automatically', async () => {
  assert.equal((await detect({ userAgentData: { platform: 'Windows', getHighEntropyValues: async () => ({ architecture: 'x86', bitness: '32' }) } })).architecture, null);
});
