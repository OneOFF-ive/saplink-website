const title = document.getElementById('download-title');
const status = document.getElementById('download-status');
const manual = document.getElementById('manual-download');
let architecture = new URLSearchParams(location.search).get('arch');

async function prepareDownload() {
  manual.hidden = true;
  if (!architecture) {
    title.textContent = '也可以手动下载安装包';
    status.textContent = '选择适合电脑的 Windows 架构，即可开始下载。';
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
  status.textContent = '正在获取最新安装包信息，请稍候。';
  manual.href = 'https://github.com/OneOFF-ive/saplink/releases/latest';
  manual.download = '';
  try {
    const release = await getCosCatalog();
    const installer = release.platforms[architecture];
    manual.href = installer.url;
    manual.download = installer.filename;
    manual.hidden = false;
    document.getElementById('installer-platform').textContent = platformName;
    document.getElementById('installer-version').textContent = 'v' + release.version;
    document.getElementById('installer-size').hidden = true;
    document.getElementById('installer-filename').textContent = installer.filename;
    document.getElementById('installer-summary').hidden = false;
    // Direct navigation avoids requiring bucket CORS for a cross-origin HEAD request.
    manual.click();
    title.textContent = '下载已发起';
    document.getElementById('architecture-label').textContent = '切换架构';
    status.textContent = '已请求浏览器下载 ' + platformName + ' 安装包，请查看浏览器的下载列表。';
    manual.addEventListener('click', () => {
      status.textContent = '已重新请求下载，请查看浏览器的下载列表。';
    });
  } catch {
    document.getElementById('installer-summary').hidden = true;
    document.getElementById('installer-filename').textContent = '';
    title.textContent = '暂时无法自动下载';
    status.textContent = '无法获取 COS 最新版本，请稍后重试，或前往 GitHub 官方发布页选择对应架构安装包。';
    manual.textContent = '前往 GitHub 官方发布页';
    manual.removeAttribute('download');
    manual.hidden = false;
  }
}

prepareDownload();
