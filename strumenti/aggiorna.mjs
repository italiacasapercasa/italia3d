// Atualização do mapa: Instagram -> eventos -> motor -> sito/data/snapshot.json.
// Uso: node strumenti/aggiorna.mjs [--completo] [--senza-instagram] [--pubblica]
//   --completo         rebaixa os comentários de todos os posts (de madrugada, por exemplo)
//   --senza-instagram  usa só o que já foi baixado (para testar regras e correções)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { raccogliere, lerConfig, PASTA_IG } from './raccoglitore.mjs';
import { Risolutore, estrairTags, estrairVoto, norm } from './risolutore.mjs';
import { gerarSnapshot } from './genera-snapshot.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CFG = path.join(RAIZ, 'config');
const ler = (arq, padrao) => { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } };

// moderação: contas bloqueadas e palavras proibidas em nomes de conta
export function contaProibida(conta, palavras) {
  const partes = conta.toLowerCase().split(/[._\d]+/).filter(Boolean);
  const junto = conta.toLowerCase().replace(/[._\d]+/g, '');
  return palavras.some(p => partes.includes(p) || (p.length >= 6 && junto.includes(p)));
}

export function montarEventi({ posts, comentarios, storie, tags = [], cfg, log = console.log }) {
  const risolutore = new Risolutore();
  const mod = ler(path.join(CFG, 'moderazione.json'), { bloccati: [], parole_vietate: [] });
  const corr = ler(path.join(CFG, 'correzioni.json'), { testi: {}, conte: {} });
  const doppi = ler(path.join(CFG, 'doppi.json'), []).map(d => ({ da: Date.parse(d.da), a: Date.parse(d.a), tipi: d.tipi ?? ['storia'] }));
  const manuali = ler(path.join(CFG, 'storie-manuali.json'), []);
  // comércios aprovados (amministra.mjs approva): ts = aprovação, fino = fim do período pago
  const commerci = ler(path.join(CFG, 'commerci.json'), []).map(n => ({ ...n, ts: Date.parse(n.approvato), fino: n.fino ? Date.parse(n.fino) : null }));
  const proprio = (cfg.username ?? '').toLowerCase();
  const bloccati = new Set(mod.bloccati.map(s => s.toLowerCase()));

  // só o que é do jogo: posts a partir de "inizio" (comentários de posts antigos podem estar no cache)
  const inizio = Date.parse(cfg.inizio), postsDoJogo = new Set(posts.map(p => p.id));
  const lista = Object.values(comentarios).filter(c => c.conta && c.conta !== proprio && postsDoJogo.has(c.post) && c.ts >= inizio).sort((a, b) => a.ts - b.ts);
  const comCidade = new Set(), revisao = new Map(), motivos = {};
  const commenti = lista.map(c => {
    if (contaProibida(c.conta, mod.parole_vietate ?? [])) bloccati.add(c.conta);
    let stato = 'valido', luogo = null;
    if (/https?:\/\//i.test(c.testo)) stato = 'rifiutato';
    else if (!comCidade.has(c.conta)) {
      const manual = corr.conte[c.conta] ?? corr.testi[norm(c.testo)];
      const r = manual ? { istat: manual, motivo: 'manuale' } : risolutore.risolvere(c.testo);
      motivos[r.motivo] = (motivos[r.motivo] ?? 0) + 1;
      if (r.istat) { luogo = r.istat; comCidade.add(c.conta); }
      else if (['omonimo', 'solo_regione'].includes(r.motivo)) {
        stato = 'pendente';
        const k = norm(c.testo);
        const item = revisao.get(k) ?? { testo: c.testo, motivo: r.motivo, candidati: r.candidati ?? [], n: 0, conte: [] };
        item.n++; if (item.conte.length < 5) item.conte.push(c.conta);
        revisao.set(k, item);
      }
    }
    return { post: c.post, conta: c.conta, ts: c.ts, luogo, tags: estrairTags(c.testo), voto: estrairVoto(c.testo), stato };
  });

  const storieEventi = [
    ...storie.filter(s => s.conta).map(s => ({ conta: s.conta, ts: s.ts })),
    ...manuali.map(s => ({ conta: s.conta.toLowerCase(), ts: Date.parse(s.ts) })),
  ].filter(s => s.ts >= inizio);   // stories de teste antes do lançamento não contam
  const rev = [...revisao.values()].sort((a, b) => b.n - a.n);
  fs.writeFileSync(path.join(PASTA_IG, '..', 'revisione.json'), JSON.stringify(rev, null, 1));
  log(`cidades: ${Object.entries(motivos).map(([k, v]) => `${k} ${v}`).join(' · ')} · ${rev.length} textos para revisar`);

  return {
    inizio,
    posts: posts.map(p => ({ id: p.id, ts: p.ts })),
    commenti,
    storie: storieEventi,
    bloccati: [...bloccati],
    doppi,
    commerci,
    post: tags.filter(t => t.ts >= inizio && t.conta !== proprio).map(t => ({ conta: t.conta, ts: t.ts })),
  };
}

export async function aggiornare({ completo = false, senzaInstagram = false, log = console.log } = {}) {
  const cfg = lerConfig();
  let dados;
  if (senzaInstagram) {
    dados = {
      posts: ler(path.join(PASTA_IG, 'posts.json'), []),
      comentarios: ler(path.join(PASTA_IG, 'commenti.json'), {}),
      storie: ler(path.join(PASTA_IG, 'storie.json'), []),
      tags: ler(path.join(PASTA_IG, 'tags.json'), []),
    };
  } else dados = await raccogliere({ completo, log });
  const estado = ler(path.join(PASTA_IG, 'stato.json'), {});
  cfg.username ??= estado.username;
  const eventi = montarEventi({ ...dados, cfg, log });
  return gerarSnapshot(eventi, { agora: Date.now(), demo: false, follower: estado.follower ?? 0 });
}

// --log: grava a saída em dati-grezzi/log/aggiorna.log (troca de arquivo ao passar de 2 MB)
function ligarLog() {
  const pasta = path.join(RAIZ, 'dati-grezzi', 'log'), arq = path.join(pasta, 'aggiorna.log');
  fs.mkdirSync(pasta, { recursive: true });
  if (fs.existsSync(arq) && fs.statSync(arq).size > 2e6) fs.renameSync(arq, `${arq}.1`);
  const escrever = (...a) => fs.appendFileSync(arq, `${new Date().toISOString()} ${a.join(' ')}\n`);
  console.log = escrever;
  console.error = escrever;
}

// trava: se outra atualização começou há menos de 15 min, esta pula a vez
function travar() {
  const arq = path.join(RAIZ, 'dati-grezzi', 'aggiorna.lock');
  try { if (Date.now() - fs.statSync(arq).mtimeMs < 15 * 60e3) return null; } catch { /* sem trava */ }
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, String(process.pid));
  return () => { try { fs.unlinkSync(arq); } catch { /* já removida */ } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = k => process.argv.includes(k);
  if (arg('--log')) ligarLog();
  const soltar = travar();
  if (!soltar) { console.log('outra atualização em andamento: pulando'); process.exit(0); }
  // --pubblica: depois de gerar o mapa, envia os dados para o site (FTP)
  aggiornare({ completo: arg('--completo'), senzaInstagram: arg('--senza-instagram') })
    .then(async () => { if (arg('--pubblica')) (await import('./pubblica.mjs')).pubblicare(); })
    .catch(e => { console.error(`ERRO: ${e.message}`); process.exitCode = 1; })
    .finally(soltar);
}
