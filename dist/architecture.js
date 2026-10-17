async function detectWindowsArchitecture(client = navigator) {
  const data = client.userAgentData;
  if (data?.platform && data.platform !== 'Windows') return null;
  if (data?.getHighEntropyValues) {
    let timer;
    try {
      const hints = await Promise.race([
        data.getHighEntropyValues(['architecture', 'bitness']),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), 1500); }),
      ]);
      if (hints?.platform === 'Windows' || data.platform === 'Windows') {
        if (hints?.architecture === 'arm' && hints.bitness === '64') return 'arm64';
        if (hints?.architecture === 'x86' && hints.bitness === '64') return 'x64';
        if (hints?.architecture) return null;
      }
    } catch {
      // Browser policy can deny architecture hints; keep the manual choice.
    } finally { clearTimeout(timer); }
  }
  // Reduced x64 user-agent strings can also describe Windows on ARM.
  // Only an explicit ARM64 marker provides a useful legacy fallback.
  if (/Windows NT/i.test(client.userAgent || '') && /\b(?:ARM64|aarch64)\b/i.test(client.userAgent)) return 'arm64';
  return null;
}

const architectureDetection = detectWindowsArchitecture();
architectureDetection.then(architecture => {
  if (!architecture) return;
  for (const link of document.querySelectorAll('[data-auto-download]')) {
    link.href = `download.html?arch=${architecture}`;
  }
});
