// Coletor do Instagram (Instagram API com login do Instagram, graph.instagram.com).
// Baixa posts e comentários (com respostas) do perfil e as menções em stories recebidas pelo webhook.
// Incremental: só rebaixa os comentários de um post quando o comments_count dele mudou.
// Comentários nunca são apagados pela coleta (a API devolve listas incompletas); casa só sai do mapa com "amministra blocca".
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
// variáveis de ambiente permitem rodar os testes sem tocar nos dados reais
export const PASTA_IG = process.env.IG_DATI ?? path.join(RAIZ, 'dati-grezzi', 'instagram');
export const CONFIG = process.env.IG_CONFIG ?? path.join(RAIZ, 'config', 'instagram.json');

const ler = (arq, padrao) => { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } };
const gravar = (arq, obj) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(`${arq}.tmp`, JSON.stringify(obj)); fs.renameSync(`${arq}.tmp`, arq); };
const espera = ms => new Promise(ok => setTimeout(ok, ms));
const tsIG = s => Date.parse(String(s).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));   // "2026-10-15T12:00:01+0000"

export function lerConfig() {
  const cfg = ler(CONFIG, null);
  if (!cfg?.token) throw new Error(`Falta config/instagram.json com o token (veja config/instagram.esempio.json)`);
  return { api: 'https://graph.instagram.com', versione: 'v25.0', ...cfg };
}

export class Instagram {
  constructor(cfg, log = console.log) {
    this.cfg = cfg;
    this.log = log;
    this.chamadas = 0;
  }

  async get(caminho, params = {}) {
    const url = caminho.startsWith('http') ? new URL(caminho) : new URL(`${this.cfg.api}/${this.cfg.versione}/${caminho}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!url.searchParams.has('access_token')) url.searchParams.set('access_token', this.cfg.token);
    for (let t = 0; ; t++) {
      this.chamadas++;
      let r, corpo;
      try { r = await fetch(url); corpo = await r.json().catch(() => ({})); } catch (e) { r = { status: 0 }; corpo = { error: { message: e.message } }; }
      if (r.status === 200 && !corpo.error) return corpo;
      const err = corpo.error ?? {};
      // limite de uso / erro temporário: espera e tenta de novo
      const temporario = r.status === 0 || r.status === 429 || r.status >= 500 || [4, 17, 32, 613].includes(err.code) || err.is_transient;
      if (!temporario || t >= 5) throw new Error(`Instagram ${r.status}: ${err.message ?? 'erro'} (${url.pathname})`);
      const ms = Math.min(60000, 1000 * 2 ** t);
      this.log(`  aguardando ${ms / 1000}s (${r.status} ${err.message ?? ''})`);
      await espera(ms);
    }
  }

  async *paginas(caminho, params) {
    let resp = await this.get(caminho, params);
    for (;;) {
      yield resp.data ?? [];
      if (!resp.paging?.next) return;
      resp = await this.get(resp.paging.next);
    }
  }

  perfil() { return this.get('me', { fields: 'user_id,username,followers_count,media_count' }); }

  async posts(desde) {
    const out = [];
    for await (const pag of this.paginas('me/media', { fields: 'id,timestamp,caption,permalink,media_type,comments_count', limit: 50 })) {
      for (const m of pag) if (tsIG(m.timestamp) >= desde) out.push({ id: m.id, ts: tsIG(m.timestamp), permalink: m.permalink, caption: m.caption ?? '', n: m.comments_count ?? 0 });
      if (pag.length && tsIG(pag[pag.length - 1].timestamp) < desde) break;   // a lista vem do mais novo para o mais velho
    }
    return out;
  }

  async comentarios(postId) {
    const CAMPOS = 'id,text,timestamp,username,from{id,username}';
    const out = [];
    const guardar = (c, pai = null) => out.push({ id: c.id, post: postId, pai, conta: (c.username ?? c.from?.username ?? '').toLowerCase(), uid: c.from?.id ?? null, ts: tsIG(c.timestamp), testo: c.text ?? '' });
    for await (const pag of this.paginas(`${postId}/comments`, { fields: `${CAMPOS},replies.limit(50){${CAMPOS}}`, limit: 50 })) {
      for (const c of pag) {
        guardar(c);
        if (!c.replies) continue;
        for (const r of c.replies.data ?? []) guardar(r, c.id);
        if (c.replies.paging?.next) for await (const p2 of this.paginas(c.replies.paging.next)) for (const r of p2) guardar(r, c.id);
      }
    }
    return out;
  }

  usuario(igsid) { return this.get(igsid, { fields: 'username' }); }

  // posts no feed em que o perfil foi marcado na foto (os mais novos primeiro)
  async marcacoes(desde) {
    const out = [];
    for await (const pag of this.paginas('me/tags', { fields: 'id,username,timestamp', limit: 50 })) {
      for (const m of pag) if (tsIG(m.timestamp) >= desde && m.username) out.push({ id: m.id, conta: m.username.toLowerCase(), ts: tsIG(m.timestamp) });
      if (pag.length && tsIG(pag[pag.length - 1].timestamp) < desde) break;
    }
    return out;
  }

  // token de longa duração vale 60 dias: renova quando passar de 30
  async renovarToken() {
    const r = await this.get(`${this.cfg.api}/refresh_access_token`, { grant_type: 'ig_refresh_token' });
    return r.access_token;
  }
}

// ---------- coleta completa ----------
export async function raccogliere({ completo = false, log = console.log } = {}) {
  const cfg = lerConfig(), ig = new Instagram(cfg, log), t0 = Date.now();
  const desde = Date.parse(cfg.inizio);
  const estado = ler(path.join(PASTA_IG, 'stato.json'), {});
  const postsAnt = new Map(ler(path.join(PASTA_IG, 'posts.json'), []).map(p => [p.id, p]));
  const comentarios = ler(path.join(PASTA_IG, 'commenti.json'), {});

  const perfil = await ig.perfil();
  log(`perfil @${perfil.username} · ${perfil.followers_count} seguidores`);
  // a conta precisa estar inscrita no webhook (menções em stories e comentários); refaz se sumir
  if (cfg.webhook_storie) {
    try {
      const sub = await ig.get('me/subscribed_apps');
      if (!sub.data?.some(a => a.subscribed_fields?.includes('messages'))) {
        const url = new URL(`${cfg.api}/${cfg.versione}/me/subscribed_apps`);
        url.searchParams.set('subscribed_fields', 'messages,comments');
        url.searchParams.set('access_token', cfg.token);
        const r = await fetch(url, { method: 'POST' });
        log(r.ok ? 'conta inscrita de novo no webhook (messages, comments)' : `não consegui inscrever a conta no webhook: HTTP ${r.status}`);
      }
    } catch (e) { log(`aviso: inscrição do webhook não verificada (${e.message})`); }
  }
  const posts = await ig.posts(desde);
  log(`${posts.length} posts desde ${cfg.inizio}`);

  let baixados = 0, novos = 0;
  const guardados = new Map();
  for (const c of Object.values(comentarios)) guardados.set(c.post, (guardados.get(c.post) ?? 0) + 1);
  for (const p of posts) {
    const ant = postsAnt.get(p.id);
    // rebaixa se o total mudou ou se temos menos comentários guardados do que o Instagram informa
    if (!completo && ant && ant.n === p.n && (guardados.get(p.id) ?? 0) >= p.n) continue;
    // a API às vezes corta a paginação no meio (posts com milhares de comentários): a lista vem incompleta.
    // Por isso só ACRESCENTA (nunca apaga o que não veio) e tenta de novo enquanto faltar muito.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const lista = await ig.comentarios(p.id);
      for (const c of lista) { if (!comentarios[c.id]) { novos++; guardados.set(p.id, (guardados.get(p.id) ?? 0) + 1); } comentarios[c.id] = c; }
      if ((guardados.get(p.id) ?? 0) >= p.n * 0.97) break;
      log(`  post ${p.id}: ${guardados.get(p.id) ?? 0} de ${p.n} comentários; tentando de novo`);
    }
    baixados++;
  }
  // comentários recebidos pelo webhook (rede de segurança para os que a API não devolver)
  if (cfg.webhook_storie) {
    try {
      const r = await fetch(`${cfg.webhook_storie}&tipo=commenti`);
      if (r.ok) {
        const doJogo = new Set(posts.map(p => p.id));
        let viaWebhook = 0;
        for (const linha of (await r.text()).split('\n')) {
          let c; try { c = JSON.parse(linha); } catch { continue; }
          if (!c?.id || !doJogo.has(c.post) || comentarios[c.id] || !c.conta) continue;
          comentarios[c.id] = c; novos++; viaWebhook++;
        }
        if (viaWebhook) log(`${viaWebhook} comentários recuperados do webhook`);
      }
    } catch (e) { log(`aviso: comentários do webhook não lidos (${e.message})`); }
  }
  log(`${baixados} posts atualizados · ${novos} comentários novos · ${Object.keys(comentarios).length} no total`);

  // stories: arquivo do webhook (no servidor) -> @ de cada IGSID
  const storie = ler(path.join(PASTA_IG, 'storie.json'), []);
  if (cfg.webhook_storie) {
    const igsid = ler(path.join(PASTA_IG, 'igsid.json'), {});
    const r = await fetch(cfg.webhook_storie);
    if (r.ok) {
      const conhecidas = new Set(storie.map(s => s.mid));
      for (const linha of (await r.text()).split('\n')) {
        if (!linha.trim()) continue;
        let s; try { s = JSON.parse(linha); } catch { continue; }
        if (!s.mid || conhecidas.has(s.mid)) continue;
        if (!igsid[s.igsid]) { try { igsid[s.igsid] = (await ig.usuario(s.igsid)).username?.toLowerCase() ?? null; } catch (e) { log(`  IGSID ${s.igsid}: ${e.message}`); } }
        storie.push({ mid: s.mid, igsid: s.igsid, conta: igsid[s.igsid] ?? null, ts: s.ts });
        conhecidas.add(s.mid);
      }
      gravar(path.join(PASTA_IG, 'igsid.json'), igsid);
      log(`${storie.length} menções em stories`);
    } else log(`webhook de stories: HTTP ${r.status}`);
  }

  // posts no feed que marcam o perfil (falha aqui não para a coleta)
  let tags = ler(path.join(PASTA_IG, 'tags.json'), []);
  try {
    const novos = await ig.marcacoes(desde), ids = new Set(tags.map(x => x.id));
    for (const m of novos) if (!ids.has(m.id)) tags.push(m);
    log(`${tags.length} posts no feed com o nosso @`);
  } catch (e) { log(`aviso: marcações não lidas (${e.message})`); }

  // renova o token quando passar de 30 dias
  const idade = Date.now() - (estado.token_em ?? 0);
  if (idade > 30 * 86400e3) {
    try {
      const novo = await ig.renovarToken();
      if (novo) { gravar(CONFIG, { ...ler(CONFIG, {}), token: novo }); estado.token_em = Date.now(); log('token renovado (+60 dias)'); }
    } catch (e) { log(`não consegui renovar o token: ${e.message}`); }
  }

  gravar(path.join(PASTA_IG, 'posts.json'), posts);
  gravar(path.join(PASTA_IG, 'commenti.json'), comentarios);
  gravar(path.join(PASTA_IG, 'storie.json'), storie);
  gravar(path.join(PASTA_IG, 'tags.json'), tags);
  gravar(path.join(PASTA_IG, 'stato.json'), { ...estado, ultima: Date.now(), username: perfil.username, follower: perfil.followers_count });
  log(`coleta: ${ig.chamadas} chamadas à API em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return { posts, comentarios, storie, tags, perfil };
}
