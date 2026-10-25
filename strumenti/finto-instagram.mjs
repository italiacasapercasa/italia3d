// Servidor que imita a API do Instagram (graph.instagram.com) para testar o coletor sem token real.
// Os comentários vêm de dati-grezzi/eventi-demo.json, convertidos em texto livre ("Sono di Napoli (NA) @amico").
// Uso: node strumenti/finto-instagram.mjs [porta]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PORTA = +(process.argv[2] ?? 5199);
const ev = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dati-grezzi', 'eventi-demo.json'), 'utf8'));
const { dados: comuni } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sito', 'data', 'comuni.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sito', 'data', 'geo.json'), 'utf8'));
const com = new Map(comuni.map(c => [c[0], c]));
const regNome = new Map(geo.regioni.map(r => [r.cod, r.nome.split('/')[0]]));

let s = 7;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const isoIG = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, '+0000');
const ESTR = { Roma: 'Rome', Milano: 'Milan', Napoli: 'Naples', Firenze: 'Florence', Venezia: 'Venice', Torino: 'Turin' };
function textoCidade(istat) {
  const [, nome, sigla, reg] = com.get(istat);
  let n = nome.split('/')[0];
  if (rnd() < 0.04 && n.length > 6) { const i = 2 + Math.floor(rnd() * (n.length - 4)); n = n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2); } // erro de digitação
  if (ESTR[n] && rnd() < 0.2) n = ESTR[n];
  const r = regNome.get(reg);
  const f = [`${n}`, `${n}, ${r}`, `Sono di ${n} (${sigla})`, `${n.toLowerCase()} ${r.toLowerCase()} 🔥`, `${n} ❤️`, `vivo a ${n}`, `${n} ${sigla}`][Math.floor(rnd() * 7)];
  return f;
}
const ENCHE = ['🔥🔥', 'ci sono!', 'dai dai', 'bellissimo', 'forza!!', '😍', 'voglio la torre', 'eccomi', ''];

// ---------- dados ----------
const posts = ev.posts.map((p, i) => ({ id: `1790${String(i).padStart(6, '0')}`, orig: p.id, ts: p.ts })).reverse();   // do mais novo para o mais velho
const postId = new Map(posts.map(p => [p.orig, p.id]));
const porPost = new Map(posts.map(p => [p.id, []]));
let idc = 0;
for (const c of ev.commenti) {
  if (c.stato === 'rifiutato' && rnd() < 0.5) continue;
  let t = c.luogo ? textoCidade(c.luogo) : c.stato === 'rifiutato' ? 'guadagna 1000€ al giorno https://spam.example' : c.stato === 'pendente' ? ['Lombardia', 'Sicilia ❤️', 'Calliano', 'Puglia!!'][Math.floor(rnd() * 4)] : ENCHE[Math.floor(rnd() * ENCHE.length)];
  for (const tg of c.tags) t += ` @${tg}`;
  if (c.voto) t += ` voto @${c.voto}`;
  const lista = porPost.get(postId.get(c.post));
  const item = { id: `c${++idc}`, text: t.trim(), timestamp: isoIG(c.ts), username: c.conta, from: { id: `u_${c.conta}`, username: c.conta }, replies: [] };
  const pai = lista.length && rnd() < 0.15 ? lista[Math.floor(rnd() * lista.length)] : null;
  if (pai) pai.replies.push(item); else lista.push(item);
}
for (const l of porPost.values()) l.reverse();   // comentários: mais novos primeiro
const storie = ev.storie.map((x, i) => JSON.stringify({ mid: `m${i}`, igsid: `ig_${x.conta}`, ts: x.ts })).join('\n');

// ---------- servidor ----------
let pedidos = 0, erroInjetado = false;
const pagina = (arr, req, url, mapa) => {
  const lim = Math.min(50, +(url.searchParams.get('limit') ?? 25)), ini = +(url.searchParams.get('after') ?? 0);
  const data = arr.slice(ini, ini + lim).map(mapa);
  const out = { data };
  if (ini + lim < arr.length) { const n = new URL(url); n.searchParams.set('after', ini + lim); out.paging = { next: `http://localhost:${PORTA}${n.pathname}${n.search}` }; }
  return out;
};
const comentario = c => ({ id: c.id, text: c.text, timestamp: c.timestamp, username: c.username, from: c.from });
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  const enviar = (st, obj) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  pedidos++;
  if (url.pathname === '/storie.jsonl') return enviar(200, storie);
  if (url.searchParams.get('access_token') !== 'TOKEN_DI_PROVA') return enviar(400, { error: { message: 'Invalid OAuth access token', code: 190 } });
  if (pedidos % 97 === 0) return enviar(500, { error: { message: 'erro temporário de teste', is_transient: true } });
  if (url.pathname.endsWith('/me/media') && !erroInjetado) { erroInjetado = true; return enviar(429, { error: { message: 'limite de teste', code: 4 } }); }
  const p = url.pathname.split('/').filter(Boolean);
  if (p[0] === 'refresh_access_token') return enviar(200, { access_token: 'TOKEN_DI_PROVA', token_type: 'bearer', expires_in: 5184000 });
  if (p[1] === 'me' && !p[2]) return enviar(200, { user_id: '1', username: 'italiacasapercasa', followers_count: 11870, media_count: posts.length });
  if (p[1] === 'me' && p[2] === 'media') return enviar(200, pagina(posts, req, url, x => ({ id: x.id, timestamp: isoIG(x.ts), caption: 'Commenta città e regione!', permalink: `https://instagram.com/p/${x.id}`, media_type: 'VIDEO', comments_count: porPost.get(x.id).reduce((n, c) => n + 1 + c.replies.length, 0) })));
  if (p[2] === 'comments') return enviar(200, pagina(porPost.get(p[1]) ?? [], req, url, c => ({ ...comentario(c), replies: c.replies.length ? pagina(c.replies, req, new URL(`http://localhost:${PORTA}/v25.0/${c.id}/replies?limit=50&access_token=TOKEN_DI_PROVA`), comentario) : undefined })));
  if (p[2] === 'replies') { for (const l of porPost.values()) for (const c of l) if (c.id === p[1]) return enviar(200, pagina(c.replies, req, url, comentario)); return enviar(404, { error: { message: 'not found' } }); }
  if (p[1]?.startsWith('ig_')) return enviar(200, { id: p[1], username: p[1].slice(3) });
  enviar(404, { error: { message: `rota desconhecida ${url.pathname}` } });
}).listen(PORTA, () => console.log(`Instagram finto em http://localhost:${PORTA} · ${posts.length} posts · ${idc} comentários`));
