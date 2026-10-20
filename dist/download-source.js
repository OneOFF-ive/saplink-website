// Binary files are served by COS. The website only forwards the small catalog.
const cosDownloadSource = Object.freeze({
  origin: 'https://saplink-1302377695.cos.ap-shanghai.myqcloud.com',
  manifest: 'releases.json',
  skillManifest: 'skill-releases.json',
});

function cosInstallerUrl(version, architecture) {
  return `${cosDownloadSource.origin}/saplink/v${version}/SapLink-${version}-win-${architecture}-setup.exe`;
}

function validateCosCatalog(catalog) {
  if (catalog?.schema_version !== 1 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(catalog.version || '') || !Array.isArray(catalog.downloads)) throw new Error('Invalid COS catalog');
  const platforms = {};
  for (const item of catalog.downloads) {
    if (!['x64', 'arm64'].includes(item.architecture) || platforms[item.architecture] || item.url !== cosInstallerUrl(catalog.version, item.architecture) || !/^[a-f0-9]{64}$/i.test(item.sha256 || '')) throw new Error('Invalid COS installer');
    platforms[item.architecture] = { ...item, filename: `SapLink-${catalog.version}-win-${item.architecture}-setup.exe` };
  }
  if (!platforms.x64 || !platforms.arm64) throw new Error('Missing COS architecture');
  return { version: catalog.version, platforms };
}

function validateSkillCatalog(catalog) {
  if (catalog?.schema_version !== 1 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(catalog.version || '')) throw new Error('Invalid skill catalog');
  const skill = catalog.skill;
  if (!skill || skill.filename !== `SapLink-${catalog.version}-skill.zip` || skill.url !== `${cosDownloadSource.origin}/saplink/v${catalog.version}/${skill.filename}` || !/^[a-f0-9]{64}$/i.test(skill.sha256 || '') || !/^[a-f0-9]{40}$/i.test(skill.commit || '') || !Number.isSafeInteger(skill.size) || skill.size <= 0 || skill.size > 16 * 1024 * 1024) throw new Error('Invalid COS skill');
  return { version: catalog.version, skill };
}

async function readCosCatalog(endpoint, validate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('COS metadata unavailable');
    return validate(await response.json());
  } finally { clearTimeout(timeout); }
}

let cosCatalogRequest;
function getCosCatalog() {
  return cosCatalogRequest ??= readCosCatalog(cosDownloadSource.manifest, validateCosCatalog);
}
let cosSkillRequest;
function getCosSkillCatalog() {
  return cosSkillRequest ??= readCosCatalog(cosDownloadSource.skillManifest, validateSkillCatalog);
}

const cosSkillLinks = [...document.querySelectorAll('[data-cos-skill]')];
if (cosSkillLinks.length) getCosSkillCatalog().then(catalog => {
  if (!catalog.skill) return;
  for (const link of cosSkillLinks) {
    link.href = catalog.skill.url;
    link.download = catalog.skill.filename;
  }
}).catch(() => {
  // The HTML retains a previously verified COS version when metadata is offline.
});
