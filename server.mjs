import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const cos = 'https://saplink-1302377695.cos.ap-shanghai.myqcloud.com';
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png' };
const server = http.createServer(async (req,res) => {
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(['/releases.json','/downloads/latest/releases.json','/skill-releases.json'].includes(pathname)) {
      const response=await fetch(`${cos}/saplink/${pathname === '/skill-releases.json' ? 'skill-latest.json' : 'latest.json'}`,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('COS catalog unavailable');
      const body=await response.text();if(Buffer.byteLength(body)>256*1024)throw new Error('Oversized catalog');
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});
      res.end(req.method==='HEAD'?undefined:body);return;
    }
    const legacy=pathname.match(/^\/downloads\/latest\/SapLink-win-(x64|arm64)-setup\.exe$/);
    if(legacy){res.writeHead(302,{Location:`/download.html?arch=${legacy[1]}#manual`});res.end();return;}
    if(['/downloads/skills/latest/saplink-manager.zip','/assets/saplink-manager-91d7bd43e91d.zip','/assets/saplink-manager-def7ead29194.zip'].includes(pathname)){res.writeHead(302,{Location:'/download.html#skill'});res.end();return;}
    if(pathname.startsWith('/downloads/')){res.writeHead(410);res.end('Open /download.html to get the latest COS download.');return;}
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const resolved=await realpath(target);const resolvedRoot=await realpath(root);
    if(!resolved.startsWith(resolvedRoot+path.sep)){res.writeHead(403);res.end();return;}
    const file=await stat(resolved);if(!file.isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(resolved)]||'application/octet-stream','Content-Length':file.size});
    if(req.method==='HEAD'){res.end();return;}
    createReadStream(resolved).on('error',()=>res.destroy()).pipe(res);
  }catch(error){
    const missing=['ENOENT','ENOTDIR'].includes(error.code);
    res.writeHead(missing?404:502);res.end(missing?'Not found':'Unable to load this resource.');
  }
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
