const title = document.getElementById('download-title');
const status = document.getElementById('download-status');
const manual = document.getElementById('manual-download');
let architecture = new URLSearchParams(location.search).get('arch');

function restoreManualDownload() {
  manual.href = new URL(`downloads/latest/SapLink-win-${architecture}-setup.exe`, document.baseURI).href;
  manual.download = '';
  manual.hidden = false;
}

async function request(url, options = {}, read = response => response) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try { return await read(await fetch(url, { ...options, signal: controller.signal })); }
  finally { clearTimeout(timeout); }
}

async function prepareDownload() {
  manual.hidden = true;
  if (!architecture) {
    title.textContent = '也可以手动下载安装包';
    status.textContent = '选择下方的 Windows 架构后，再开始下载安装包。';
    document.getElementById('download-fallback').hidden = true;
    return;
  }
  if (architecture === 'auto') architecture = await architectureDetection;
  if (!['x64', 'arm64'].includes(architecture)) {
    title.textContent = '请选择你的安装包';
    status.textContent = '请在下方选择 Windows x64 或 ARM64 安装包。';
    document.getElementById('download-fallback').hidden = true;
    return;
  }
  const platformName = architecture === 'arm64' ? 'Windows ARM64' : 'Windows x64';
  document.querySelector(`[data-arch="${architecture}"]`).setAttribute('aria-current', 'true');
  document.getElementById('download-fallback').hidden = false;
  title.textContent = '正在准备你的下载';
  status.textContent = '正在获取安装包信息，请稍候。';
  // The stable endpoint follows the same latest-version pointer as the manifest.
  restoreManualDownload();
  try {
    const release = await request('downloads/latest/releases.json', { cache: 'no-store' }, response => {
      if (!response.ok) throw new Error('Release metadata unavailable');
      return response.json();
    });
    const installer = release.platforms?.[architecture];
    if (!installer || typeof release.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(release.version) || !Number.isSafeInteger(installer.size) || installer.size <= 0 || !/^[0-9a-f]{64}$/i.test(installer.sha256 || '')) throw new Error('Invalid release metadata');
    const expectedFilename = `SapLink-${release.version}-win-${architecture}-setup.exe`;
    if (installer.filename !== expectedFilename || installer.url !== `downloads/v${release.version}/${expectedFilename}`) throw new Error('Invalid download location');
    const url = new URL(installer.url, document.baseURI);
    manual.href = url.href;
    manual.download = installer.filename;
    manual.hidden = false;
    document.getElementById('installer-platform').textContent = platformName;
    document.getElementById('installer-version').textContent = 'v' + release.version;
    document.getElementById('installer-size').textContent = (installer.size / 1024 / 1024).toFixed(1) + ' MB';
    document.getElementById('installer-filename').textContent = installer.filename;
    document.getElementById('installer-summary').hidden = false;
    const file = await request(url.href, { method: 'HEAD', cache: 'no-store' });
    if (!file.ok) throw new Error('Installer unavailable');
    const length = file.headers.get('content-length');
    if (length !== null && Number(length) !== installer.size) throw new Error('Installer size mismatch');
    manual.click();
    title.textContent = '下载已发起';
    status.textContent = '已请求浏览器下载 ' + platformName + ' 安装包，请查看浏览器的下载列表。';
    manual.addEventListener('click', () => {
      status.textContent = '已重新请求下载，请查看浏览器的下载列表。';
    });
  } catch {
    restoreManualDownload();
    document.getElementById('installer-summary').hidden = true;
    document.getElementById('installer-filename').textContent = '';
    title.textContent = '暂时无法自动下载';
    status.textContent = '请使用下方链接手动重试。如果仍无法下载，请稍后再试。';
    manual.hidden = false;
  }
}

prepareDownload();
