// Servidor estático de desenvolvimento para a pasta sito/.
// Uso: node strumenti/server.mjs [porta]  ->  http://localhost:5173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', 'sito');
const PORTA = +(process.argv[2] ?? 5173);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let arq = path.join(RAIZ, url.endsWith('/') ? url + 'index.html' : url);
  if (!arq.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
  fs.readFile(arq, (err, dados) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}).listen(PORTA, () => console.log(`http://localhost:${PORTA}`));
