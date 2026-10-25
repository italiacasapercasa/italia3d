// Motor de regras: eventos brutos do Instagram -> snapshot do site.
// Recalcula tudo do zero a cada execução (determinístico: mesmos eventos = mesmo mapa).
//
// eventi = {
//   inizio: ms,                                   // início do jogo (1º post)
//   posts:   [{ id, ts }],
//   commenti:[{ post, conta, ts, luogo: istat|null, tags: [conta], voto: conta|null, stato: 'valido'|'pendente'|'rifiutato' }],
//   storie:  [{ conta, ts }],                     // story que marcou o perfil
//   bloccati:[conta],                             // escondidos do mapa (lote fica reservado)
//   doppi:   [{ da: ms, a: ms, tipi: ['storia'] | ['tutto'] }],
// }
import { REGOLE, livelloDi } from '../sito/js/regole.js';
import { giornoRoma, limitiMandati, mandatoDi } from '../sito/js/tempo.js';

const F = { casa: 0, commento: 1, extra: 2, tag: 3, recluta: 4, voto: 5, storia: 6 };
const NOMES_F = Object.keys(F);
const dia = 86400e3;
const ontem = d => new Date(Date.parse(`${d}T12:00:00Z`) - dia).toISOString().slice(0, 10);

export function calcolare({ eventi, comuni, regioni, agora, versao = 'snap', demo = false, follower = 0 }) {
  const R = REGOLE, P = R.punti;
  const comIdx = new Map(comuni.map((c, i) => [c[0], i]));
  const bloccati = new Set((eventi.bloccati ?? []).map(s => s.toLowerCase()));
  const doppi = eventi.doppi ?? [];
  const lim = limitiMandati(eventi.inizio, agora);
  const kc = mandatoDi(lim, agora);
  const fator = (f, ts) => (doppi.some(d => ts >= d.da && ts < d.a && (d.tipi.includes('tutto') || d.tipi.includes(NOMES_F[f]))) ? 2 : 1);

  const contas = new Map(), luoghi = new Map(), postEst = new Map(), votos = new Set(), eventos = [];
  const cont = { commenti: 0, validi: 0, pendenti: 0, rifiutati: 0, storie: 0 };
  const conta = nome => {
    const k = nome.toLowerCase();
    let a = contas.get(k);
    if (!a) contas.set(k, a = { conta: k, casa: null, tot: 0, fonti: [0, 0, 0, 0, 0, 0, 0], perM: [], giorni: new Set(), giorniStoria: new Set(), fiamme: 0, taggatoDa: null, recrutado: false, bloc: bloccati.has(k) });
    return a;
  };
  const add = (a, f, pts, ts) => {
    if (a.bloc) return;
    pts *= fator(f, ts);
    const antes = livelloDi(a.tot);
    a.tot += pts;
    a.fonti[f] += pts;
    const k = mandatoDi(lim, ts);
    a.perM[k] = (a.perM[k] ?? 0) + pts;
    const depois = livelloDi(a.tot);
    if (depois > antes && depois >= 10) eventos.push({ tipo: 'livello', conta: a.conta, livello: depois, ts });
  };
  const criarCasa = (a, ci, ts) => {
    let l = luoghi.get(ci);
    if (!l) {
      luoghi.set(ci, l = { ci, visiveis: [], lotti: 0, ts });
      if (!a.bloc) eventos.push({ tipo: 'citta_fondata', luogo: comuni[ci][0], fondatore: a.conta, ts });
    } else if (l.visiveis.length === 1 && !a.bloc && ts - l.visiveis[0].casa.ts < R.disputa_s * 1000) {
      eventos.push({ tipo: 'disputa', luogo: comuni[ci][0], fondatore: l.visiveis[0].conta, secondo: a.conta, differenza_s: Math.round((ts - l.visiveis[0].casa.ts) / 1000), ts });
    }
    a.casa = { ci, ts, lote: l.lotti++ };
    if (!a.bloc) l.visiveis.push(a);
    add(a, F.casa, P.casa, ts);
    if (a.taggatoDa && !a.recrutado) {
      a.recrutado = true;
      const quem = contas.get(a.taggatoDa);
      if (quem?.casa) add(quem, F.recluta, P.recluta, ts);
    }
  };

  // ---------- linha do tempo ----------
  const linha = [
    ...eventi.commenti.map(c => ({ t: 'c', ts: c.ts, c })),
    ...eventi.storie.map(s => ({ t: 's', ts: s.ts, s })),
  ].filter(e => e.ts <= agora).sort((a, b) => a.ts - b.ts);

  for (const e of linha) {
    if (e.t === 'c') {
      const c = e.c;
      cont.commenti++;
      if (c.stato === 'pendente') { cont.pendenti++; continue; }
      if (c.stato !== 'valido') { cont.rifiutati++; continue; }
      cont.validi++;
      const a = conta(c.conta);
      if (!a.casa && c.luogo != null && comIdx.has(c.luogo)) criarCasa(a, comIdx.get(c.luogo), c.ts);
      if (!a.casa) continue;                       // ainda sem cidade: "casa riservata"
      const ch = `${c.post}|${a.conta}`;
      let s = postEst.get(ch);
      if (!s) postEst.set(ch, s = { n: 0, tags: new Set() });
      s.n++;
      if (s.n === 1) add(a, F.commento, P.commento, c.ts);
      else if (R.extra_attivo && s.n - 1 <= R.limiti.extra) add(a, F.extra, P.extra, c.ts);
      for (const t0 of c.tags ?? []) {
        const t = t0.toLowerCase();
        if (t === a.conta || s.tags.has(t) || s.tags.size >= R.limiti.tag) continue;
        s.tags.add(t);
        add(a, F.tag, P.tag, c.ts);
        const alvo = conta(t);
        if (!alvo.casa && !alvo.taggatoDa) alvo.taggatoDa = a.conta;
      }
      if (c.voto) {
        const v = c.voto.toLowerCase(), alvo = contas.get(v);
        if (v !== a.conta && alvo?.casa && !votos.has(ch)) { votos.add(ch); add(alvo, F.voto, P.voto, c.ts); }
      }
      a.giorni.add(giornoRoma(c.ts));
    } else {
      const a = contas.get(e.s.conta.toLowerCase());
      if (!a?.casa || a.bloc) continue;
      cont.storie++;
      const d = giornoRoma(e.ts);
      if (!a.giorniStoria.has(d)) { a.giorniStoria.add(d); add(a, F.storia, P.storia, e.ts); }
      a.fiamme = Math.max(a.fiamme, e.ts + R.fiamme_h * 3600e3);
      a.giorni.add(d);
    }
  }

  // ---------- casas visíveis ----------
  const casas = [...contas.values()].filter(a => a.casa && !a.bloc);
  const sett = a => a.perM[kc] ?? 0;
  const regDe = a => comuni[a.casa.ci][3];
  const istatDe = a => comuni[a.casa.ci][0];
  const ordem = (k) => (x, y) => (y.perM[k] ?? 0) - (x.perM[k] ?? 0) || x.casa.ts - y.casa.ts;

  // ---------- eleições de domingo (presidente e sindaci) ----------
  let presidente = null, sindaci = {};
  for (let k = 1; k < kc; k++) {
    sindaci = {};   // cada eleição substitui os sindaci da semana anterior
    const fim = lim[k], eleg = casas.filter(a => a.casa.ts < fim && (a.perM[k] ?? 0) > 0).sort(ordem(k));
    if (eleg[0]) {
      presidente = { conta: eleg[0].conta, pts_elezione: eleg[0].perM[k], eletto_nel_mandato: k };
      eventos.push({ tipo: 'presidente_eletto', conta: eleg[0].conta, pts: eleg[0].perM[k], ts: fim });
    }
    const vistos = new Set();
    for (const a of eleg) {
      const ist = istatDe(a);
      if (vistos.has(ist) || a.conta === presidente?.conta) continue;
      vistos.add(ist);
      sindaci[ist] = { conta: a.conta, eletto_nel_mandato: k };
    }
  }

  // ---------- cargos ao vivo (um por pessoa, de cima para baixo) ----------
  const usados = new Set([presidente?.conta, ...Object.values(sindaci).map(s => s.conta)].filter(Boolean));
  const ativos = casas.filter(a => sett(a) > 0).sort(ordem(kc));
  const livres = filtro => ativos.filter(a => !usados.has(a.conta) && filtro(a));
  const marcar = a => { usados.add(a.conta); return { conta: a.conta, pts: sett(a) }; };
  const cariche = { presidente: null, leader: null, regioni: {}, sindaci: {}, consiglieri: {} };
  if (presidente) { const p = contas.get(presidente.conta); cariche.presidente = { ...presidente, pts: sett(p) }; }
  if (ativos[0]) cariche.leader = { conta: ativos[0].conta, pts: sett(ativos[0]) };
  for (const r of regioni) cariche.regioni[r.cod] = { senatori: [], presidente: null, deputati: [] };
  for (const r of regioni) cariche.regioni[r.cod].senatori = livres(a => regDe(a) === r.cod).slice(0, R.posti.senatoriPerRegione).map(marcar);
  for (const r of regioni) { const a = livres(x => regDe(x) === r.cod)[0]; cariche.regioni[r.cod].presidente = a ? marcar(a) : null; }
  const popTot = regioni.reduce((s, r) => s + r.pop, 0);
  for (const r of regioni) {
    const vagas = Math.max(R.posti.deputatiMinimo, Math.round(R.posti.deputati * r.pop / popTot));
    cariche.regioni[r.cod].deputati = livres(a => regDe(a) === r.cod).slice(0, vagas).map(marcar);
  }
  for (const [ist, s] of Object.entries(sindaci)) cariche.sindaci[ist] = { ...s, pts: sett(contas.get(s.conta)) };
  const porComune = new Map();
  for (const a of livres(() => true)) { const ist = istatDe(a); if (!porComune.has(ist)) porComune.set(ist, []); porComune.get(ist).push(a); }
  for (const [ist, lista] of porComune) cariche.consiglieri[ist] = lista.slice(0, R.posti.consiglieri).map(marcar);

  // guerra delle regioni
  const ptsReg = new Map(regioni.map(r => [r.cod, 0]));
  for (const a of casas) ptsReg.set(regDe(a), ptsReg.get(regDe(a)) + sett(a));
  cariche.guerra = [...ptsReg].map(([cod, pts]) => ({ cod, pts })).sort((a, b) => b.pts - a.pts);

  // ---------- luoghi e casas na saída ----------
  const lugares = [...luoghi.values()].filter(l => l.visiveis.length).sort((a, b) => a.ts - b.ts);
  const liDe = new Map(lugares.map((l, i) => [l.ci, i]));
  const hoje = giornoRoma(agora);
  const serie = a => {
    let d = a.giorni.has(hoje) ? hoje : ontem(hoje), n = 0;
    while (a.giorni.has(d)) { n++; d = ontem(d); }
    return n;
  };
  const saidaCasas = casas.sort((a, b) => a.casa.ts - b.casa.ts).map(a => [
    a.conta, liDe.get(a.casa.ci), a.casa.lote, Math.round(a.casa.ts / 1000), a.tot, sett(a),
    a.fiamme > agora ? Math.round(a.fiamme / 1000) : 0, a.fonti, serie(a),
  ]);

  // derby: primeiro par do rodízio com casas nas duas cidades
  let derby = null;
  for (let i = 0; i < R.derby.length && !derby; i++) {
    const [a, b] = R.derby[(kc - 1 + i) % R.derby.length];
    const la = lugares.find(l => comuni[l.ci][0] === a), lb = lugares.find(l => comuni[l.ci][0] === b);
    if (la && lb) derby = { a, b, pts_a: la.visiveis.reduce((s, x) => s + sett(x), 0), pts_b: lb.visiveis.reduce((s, x) => s + sett(x), 0) };
  }

  return {
    formato: 'italia-casa-per-casa/snapshot@1',
    versao, demo, regola: R.versao,
    gerado_em: new Date().toISOString(),
    dati_fino: new Date(agora).toISOString(),
    mandato: { n: kc, inizio: new Date(lim[kc - 1]).toISOString(), fine: new Date(lim[kc]).toISOString() },
    contatori: {
      commenti: cont.commenti, commenti_validi: cont.validi, commenti_pendenti: cont.pendenti, commenti_rifiutati: cont.rifiutati,
      contas: contas.size, case: casas.length, case_nascoste: [...contas.values()].filter(a => a.casa && a.bloc).length,
      luoghi: lugares.length, regioni: regioni.length, comuni: comuni.length, storie: cont.storie, follower,
    },
    doppi: doppi.filter(d => d.a > agora - dia && d.da < agora + dia).map(d => ({ da: new Date(d.da).toISOString(), a: new Date(d.a).toISOString(), tipi: d.tipi })),
    luoghi: lugares.map(l => [l.ci, l.visiveis.length, l.visiveis[0].conta, Math.round(l.visiveis[0].casa.ts / 1000), l.lotti]),
    // [conta, luogo, lote, ts, punti_totali, punti_settimana, fiamme_fino, [fonti], serie_giorni]
    case: saidaCasas,
    cariche,
    derby,
    eventi: eventos.filter(e => e.ts <= agora).sort((a, b) => b.ts - a.ts).slice(0, 40).map(e => ({ ...e, ts: new Date(e.ts).toISOString() })),
  };
}
