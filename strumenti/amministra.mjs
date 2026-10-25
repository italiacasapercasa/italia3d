// Comandos de administração do jogo.
// Uso: node strumenti/amministra.mjs <comando> [argumentos]   (sem comando: mostra a ajuda)
import fs from 'node:fs';
import path from 'node:path';
import { Risolutore, norm } from './risolutore.mjs';
import { PASTA_IG, CONFIG } from './raccoglitore.mjs';
import { daRoma } from '../sito/js/tempo.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CFG = path.join(RAIZ, 'config');
const ler = (arq, padrao) => { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } };
const gravar = (arq, obj) => fs.writeFileSync(arq, JSON.stringify(obj, null, 2));
const [cmd, ...args] = process.argv.slice(2);

const AJUDA = `
Comandos (depois de mudar algo, rode "node strumenti/aggiorna.mjs --senza-instagram" para refazer o mapa):

  stato                                  resumo: última coleta, token, casas, pendentes
  prova "<texto>"                        mostra qual cidade o resolvedor entende
  pendenti [n]                           textos sem cidade para revisar
  correggi "<texto>" <comune>            ensina: esse texto = esse comune (nome, "Nome (SIGLA)" ou código ISTAT)
  assegna <conta> <comune>               define a cidade de uma conta
  blocca <conta> | sblocca <conta>       esconde/mostra a casa de uma conta
  storia <conta> ["AAAA-MM-GG HH:MM"]    credita uma story manualmente (hora de Roma; padrão: agora)
  doppi "<início>" "<fim>" [storia|tutto]  pontos em dobro (hora de Roma, ex.: "2026-11-08 10:00")
  doppi lista | doppi limpa
`;

function comune(arg) {
  const r = new Risolutore();
  if (/^\d{6}$/.test(arg) && r.comuni.has(arg)) return r.comuni.get(arg);
  const m = arg.match(/^(.*)\(([A-Za-z]{2})\)\s*$/);
  if (m) { const c = [...r.comuni.values()].find(c => norm(c.nome) === norm(m[1]) && c.sigla === m[2].toUpperCase()); if (c) return c; }
  const res = r.risolvere(arg);
  if (res.istat) return r.comuni.get(res.istat);
  throw new Error(`Não achei o comune "${arg}" (${res.motivo}${res.candidati ? `: ${res.candidati.join(', ')}` : ''}). Use "Nome (SIGLA)" ou o código ISTAT.`);
}
const horaRoma = s => {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Data inválida "${s}". Use "AAAA-MM-GG HH:MM" (hora de Roma).`);
  return new Date(daRoma(+m[1], +m[2], +m[3], +m[4], +m[5])).toISOString();
};

try {
  switch (cmd) {
    case 'stato': {
      const st = ler(path.join(PASTA_IG, 'stato.json'), {}), snap = ler(path.join(RAIZ, 'sito', 'data', 'snapshot.json'), {});
      const rev = ler(path.join(PASTA_IG, '..', 'revisione.json'), []), mod = ler(path.join(CFG, 'moderazione.json'), { bloccati: [] });
      console.log(`config: ${fs.existsSync(CONFIG) ? 'ok' : 'FALTA config/instagram.json'}`);
      console.log(`última coleta: ${st.ultima ? new Date(st.ultima).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : 'nunca'} · @${st.username ?? '?'} · ${st.follower ?? '?'} seguidores`);
      console.log(`token renovado: ${st.token_em ? `há ${Math.round((Date.now() - st.token_em) / 86400e3)} dias (vale 60)` : 'nunca'}`);
      console.log(`mapa: ${snap.versao ?? '—'} · ${snap.contatori?.case ?? 0} casas · ${snap.contatori?.luoghi ?? 0} cidades · mandato ${snap.mandato?.n ?? '?'}`);
      console.log(`revisão: ${rev.length} textos pendentes · ${mod.bloccati.length} contas bloqueadas`);
      break;
    }
    case 'prova': {
      const r = new Risolutore().risolvere(args.join(' '));
      console.log(r.istat ? `→ ${r.nome} (${r.istat}) · ${r.motivo}` : `→ nenhuma cidade · ${r.motivo}${r.candidati ? `: ${r.candidati.join(', ')}` : ''}`);
      break;
    }
    case 'pendenti': {
      const rev = ler(path.join(PASTA_IG, '..', 'revisione.json'), []);
      if (!rev.length) { console.log('Nenhum texto pendente.'); break; }
      for (const x of rev.slice(0, +(args[0] ?? 30))) console.log(`${String(x.n).padStart(4)}×  ${JSON.stringify(x.testo)}  · ${x.motivo}${x.candidati.length ? ` [${x.candidati.join(', ')}]` : ''}  ex.: @${x.conte.join(' @')}`);
      break;
    }
    case 'correggi': {
      const [texto, alvo] = args;
      const c = comune(alvo), corr = ler(path.join(CFG, 'correzioni.json'), { testi: {}, conte: {} });
      corr.testi[norm(texto)] = c.istat;
      gravar(path.join(CFG, 'correzioni.json'), corr);
      console.log(`ok: "${texto}" → ${c.nome} (${c.sigla})`);
      break;
    }
    case 'assegna': {
      const [conta, alvo] = args;
      const c = comune(alvo), corr = ler(path.join(CFG, 'correzioni.json'), { testi: {}, conte: {} });
      corr.conte[conta.replace(/^@/, '').toLowerCase()] = c.istat;
      gravar(path.join(CFG, 'correzioni.json'), corr);
      console.log(`ok: @${conta.replace(/^@/, '')} → ${c.nome} (${c.sigla}) (vale se a conta ainda não tem casa)`);
      break;
    }
    case 'blocca': case 'sblocca': {
      const conta = args[0].replace(/^@/, '').toLowerCase(), mod = ler(path.join(CFG, 'moderazione.json'), { bloccati: [], parole_vietate: [] });
      mod.bloccati = mod.bloccati.filter(x => x !== conta);
      if (cmd === 'blocca') mod.bloccati.push(conta);
      gravar(path.join(CFG, 'moderazione.json'), mod);
      console.log(`ok: @${conta} ${cmd === 'blocca' ? 'bloqueada (a casa some do mapa, o lote fica reservado)' : 'desbloqueada'}`);
      break;
    }
    case 'storia': {
      const conta = args[0].replace(/^@/, '').toLowerCase(), ts = args[1] ? horaRoma(args[1]) : new Date().toISOString();
      const l = ler(path.join(CFG, 'storie-manuali.json'), []);
      l.push({ conta, ts });
      gravar(path.join(CFG, 'storie-manuali.json'), l);
      console.log(`ok: story de @${conta} em ${ts}`);
      break;
    }
    case 'doppi': {
      const arq = path.join(CFG, 'doppi.json'), l = ler(arq, []);
      if (args[0] === 'lista') { console.log(l.length ? l.map(d => `${d.da} → ${d.a} · ${d.tipi.join(', ')}`).join('\n') : 'nenhum'); break; }
      if (args[0] === 'limpa') { gravar(arq, []); console.log('ok: sem pontos em dobro'); break; }
      const d = { da: horaRoma(args[0]), a: horaRoma(args[1]), tipi: [args[2] ?? 'storia'] };
      if (!['storia', 'tutto'].includes(d.tipi[0])) throw new Error('tipo deve ser "storia" ou "tutto"');
      l.push(d);
      gravar(arq, l);
      console.log(`ok: pontos em dobro (${d.tipi[0]}) de ${args[0]} a ${args[1]} (hora de Roma)`);
      break;
    }
    default:
      console.log(AJUDA);
  }
  // mudou alguma configuração do jogo: envia para o servidor (o robô do GitHub usa a de lá)
  const muda = ['correggi', 'assegna', 'blocca', 'sblocca', 'storia'].includes(cmd) || (cmd === 'doppi' && args[0] !== 'lista');
  if (muda && fs.existsSync(path.join(CFG, 'hostinger.json'))) {
    try { (await import('./pubblica.mjs')).pubblicare({ config: true, log: () => {} }); console.log('configuração enviada ao servidor (vale na próxima atualização automática)'); }
    catch (e) { console.log(`aviso: não consegui enviar ao servidor (${e.message}); rode "node strumenti/pubblica.mjs --config" depois`); }
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
}
