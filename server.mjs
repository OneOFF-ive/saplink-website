import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const downloads = path.resolve('local/downloads');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname === '/releases.json') pathname = '/downloads/latest/releases.json';
    const isDownload = pathname.startsWith('/downloads/');
    const base = isDownload ? downloads : root;
    const target = path.resolve(base, isDownload ? pathname.slice('/downloads/'.length) : '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
    const resolved = await realpath(target);
    const resolvedBase = await realpath(base);
    if (!resolved.startsWith(resolvedBase + path.sep)) { res.writeHead(403); res.end(); return; }
    const file = await stat(resolved);
    if (!file.isFile()) { res.writeHead(404); res.end(); return; }
    const headers = { 'Content-Type': types[path.extname(resolved)] || 'application/octet-stream', 'Content-Length': file.size };
    if (pathname.startsWith('/downloads/latest/')) headers['Cache-Control'] = 'no-store';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(resolved).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
