import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const catalogSource = readFileSync(new URL('../dist/download-source.js', import.meta.url), 'utf8');
const original = readFileSync(new URL('../dist/download.js', import.meta.url), 'utf8');
const script = original.replace(/prepareDownload\(\);\s*$/, 'globalThis.completion = prepareDownload();');
assert.notEqual(script, original);
const origin = 'https://saplink-1302377695.cos.ap-shanghai.myqcloud.com';
function fixture(version = '2.3.4') {
  return { schema_version: 1, version,
    downloads: ['x64','arm64'].map(architecture => ({architecture, url:`${origin}/saplink/v${version}/SapLink-${version}-win-${architecture}-setup.exe`,sha256:'a'.repeat(64)})),
    skill: {commit:'b'.repeat(40),filename:`SapLink-${version}-skill.zip`,url:`${origin}/saplink/v${version}/SapLink-${version}-skill.zip`,sha256:'b'.repeat(64),size:12345},
  };
}
async function openPage(architecture, {version, detected=null, mode='success', mutate, skill=false} = {}) {
  const catalog=fixture(version); mutate?.(catalog);
  const nodes = new Map();
  const node = id => {
    if(!nodes.has(id)) nodes.set(id,{textContent:'',hidden:false,clicks:0,handlers:{},setAttribute(){},removeAttribute(){},addEventListener(name,fn){this.handlers[name]=fn;},click(){this.clicks++;this.handlers.click?.();}});
    return nodes.get(id);
  };
  const skillLink={href:'fallback-skill.zip'};
  const requests=[];
  const context=vm.createContext({URL,URLSearchParams,AbortController,setTimeout,clearTimeout,
    architectureDetection:Promise.resolve(detected),location:{search:architecture===null?'':'?arch='+architecture},
    document:{getElementById:node,querySelector:node,querySelectorAll:()=>skill?[skillLink]:[]},
    fetch:async(url,options)=>{
      requests.push(String(url));assert.ok(['releases.json','skill-releases.json'].includes(url));assert.equal(options.cache,'no-store');
      if(mode==='network-error')throw new Error('Offline');
      return {ok:mode!=='metadata-missing',json:async()=>{if(mode==='invalid-json')throw new SyntaxError('Invalid');return String(url)==='skill-releases.json' ? {schema_version:1,version:catalog.version,skill:structuredClone(catalog.skill)} : {schema_version:1,version:catalog.version,downloads:structuredClone(catalog.downloads)};}};
    },
  });
  vm.runInContext(catalogSource,context);vm.runInContext(script,context);await context.completion;
  if(skill){try{await vm.runInContext('getCosSkillCatalog()',context);}catch{} await Promise.resolve();}
  return {node,requests,skillLink,catalog};
}
for(const arch of ['x64','arm64']) {
  test(`${arch}: downloads directly from COS without fetching binary files through the website`,async()=>{
    const {node,requests,catalog}=await openPage(arch);
    assert.equal(node('manual-download').href,catalog.downloads.find(d=>d.architecture===arch).url);
    assert.equal(node('manual-download').clicks,1);assert.equal(node('download-title').textContent,'下载已发起');
    assert.deepEqual(requests,['releases.json']);
  });
  test(`${arch}: follows future COS versions`,async()=>{
    const {node}=await openPage(arch,{version:'7.8.9'});
    assert.equal(node('manual-download').href,`${origin}/saplink/v7.8.9/SapLink-7.8.9-win-${arch}-setup.exe`);
  });
}
test('automatic architecture resolution uses ARM64',async()=>{const {node}=await openPage('auto',{detected:'arm64'});assert.match(node('manual-download').href,/win-arm64-setup.exe$/);assert.equal(node('manual-download').clicks,1);});
for(const arch of [null,'auto','unsupported'])test(`${arch}: no installer request before architecture selection`,async()=>{const {requests,node}=await openPage(arch);assert.equal(requests.length,0);assert.equal(node('manual-download').clicks,0);});
for(const mode of ['network-error','metadata-missing','invalid-json'])test(`${mode}: offers GitHub without silently selecting an old installer`,async()=>{const {node}=await openPage('arm64',{mode});assert.equal(node('manual-download').clicks,0);assert.equal(node('manual-download').href,'https://github.com/OneOFF-ive/saplink/releases/latest');assert.match(node('download-status').textContent,/GitHub/);});
for(const [name,mutate] of [
  ['foreign installer URL',c=>{c.downloads[0].url='https://example.org/file.exe';}],
  ['wrong architecture URL',c=>{c.downloads[0].url=c.downloads[1].url;}],
  ['missing architecture',c=>{c.downloads.pop();}],
  ['duplicate architecture',c=>{c.downloads.push(c.downloads[0]);}],
  ['invalid checksum',c=>{c.downloads[0].sha256='invalid';}],
  ['untrusted version',c=>{c.version='../other';}],
])test(`${name}: rejects metadata without triggering an automatic download`,async()=>{const {node}=await openPage('x64',{mutate});assert.equal(node('manual-download').clicks,0);assert.equal(node('download-title').textContent,'暂时无法自动下载');});
test('skill-only page refreshes its COS link without downloading an installer',async()=>{const {node,requests,skillLink,catalog}=await openPage(null,{skill:true,version:'7.8.9'});assert.equal(skillLink.href,catalog.skill.url);assert.equal(node('manual-download').clicks,0);assert.equal(requests.length,1);});
test('skill metadata uses a separate request from the legacy installer catalog',async()=>{const {requests}=await openPage('x64',{skill:true});assert.deepEqual(requests.sort(),['releases.json','skill-releases.json']);});
test('manual retry keeps the validated COS link',async()=>{const {node}=await openPage('x64');const link=node('manual-download');const href=link.href;link.click();assert.equal(link.href,href);assert.equal(link.clicks,2);assert.match(node('download-status').textContent,/重新请求/);});

test('installer catalog remains usable before a skill has been published',async()=>{const {node}=await openPage('x64',{mutate:c=>{delete c.skill;}});assert.equal(node('manual-download').clicks,1);});

for (const [name, mutate] of [
  ['foreign skill URL', c=>{c.skill.url='https://example.org/skill.zip';}],
  ['invalid skill size', c=>{c.skill.size=0;}],
  ['missing skill', c=>{delete c.skill;}],
]) test(`${name}: cannot block installer downloads`, async()=>{
  const {node,skillLink}=await openPage('x64',{skill:true,mutate});
  assert.equal(node('manual-download').clicks,1);
  assert.equal(skillLink.href,'fallback-skill.zip');
});
