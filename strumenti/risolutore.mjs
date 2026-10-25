// Resolvedor: texto livre de um comentário -> comune oficial (ISTAT).
// Ex.: "Sono di Torre del Greco (NA) 🔥" -> 063084. Sem certeza, devolve istat null e o motivo.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');

export const norm = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/[’'`´]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// artigos e preposições: ignorados ao comparar nomes ("Reggio di Calabria" = "reggio calabria")
const STOP = new Set('di de del dello della dei degli delle d l la lo il le i gli nel nell nella nello sul sull sulla in e al alla all a da dal dalla dalle sur'.split(' '));
// palavras comuns que não devem virar cidade por aproximação
const COMUNS = new Set(('sono vivo abito vengo citta provincia prov regione comune ciao ecco mia casa from nato nata qui originario originaria provengo residente ' +
  'paese zona vicino grazie siamo voto anche tutti italia italy forza amore sempre bella bello buongiorno buonasera salve eccomi presente io noi ' +
  'voglio vorrei una mio mia casetta grande piccolo piccola centro periferia frazione quartiere sud nord isola mare montagna lago fiume ' +
  'cittadina paesino paesello paesino terra provincia hello rome milan the and with love fratm frate bro amici amico amica ' +
  // vocabulário do próprio jogo
  'torre torri villa palazzo castello grattacielo masseria casale residenza vetta mappa punti punto livello sindaco presidente ' +
  'senatore deputato consigliere storia storie story fiamme fuoco derby votami votate taggo tagga seguo segui like follow ' +
  'voglio vogliamo dai daje grande grandi bellissimo bellissima stupendo top primo prima ultimo ancora').split(' '));
// comuni cujo nome é uma palavra comum: só valem com confirmação (região/sigla) ou sozinhos com maiúscula
const COMUNI_PAROLE = new Set(('bella vita sale bra lu ne re vo ala mori ama ponte cento nove noto chiari vasto este cori rose monti ossi orte lago calcio ' +
  'mele zone paese ora nus lei bono mara dolo oria erba arco malo pero carbone molare segni fondi castelli canale stella ponti scala giove ' +
  'premia tula fara gioia serra stazzema morra nemi gallo croce lazzate bosco ville cervo pace campo casa terme forno monte porto riva').split(' '));

// nomes estrangeiros, apelidos e frações muito citadas -> nome oficial do comune
const ALIAS = {
  rome: 'Roma', rom: 'Roma', milan: 'Milano', mailand: 'Milano', naples: 'Napoli', napule: 'Napoli', florence: 'Firenze', venice: 'Venezia',
  turin: 'Torino', genoa: 'Genova', padua: 'Padova', mantua: 'Mantova', syracuse: 'Siracusa', leghorn: 'Livorno', sardinia: null,
  ostia: 'Roma', 'lido di ostia': 'Roma', acilia: 'Roma', mestre: 'Venezia', marghera: 'Venezia', lido: null,
  'reggio calabria': 'Reggio di Calabria', 'reggio emilia': "Reggio nell'Emilia", 'monza brianza': 'Monza', bozen: 'Bolzano',
  'pesaro urbino': 'Pesaro', 'massa carrara': 'Massa', 'barletta andria trani': 'Barletta', aquila: "L'Aquila", spezia: 'La Spezia',
};

const REG_EXTRA = {
  '02': ['valle d aosta', 'val d aosta', 'vda', 'vallee d aoste'],
  '04': ['trentino', 'alto adige', 'trentino alto adige', 'sudtirol', 'suedtirol', 'taa'],
  '06': ['friuli', 'friuli venezia giulia', 'fvg'],
  '08': ['emilia', 'romagna', 'emilia romagna'],
  '20': ['sardinia'], '19': ['sicily'], '15': [], '16': ['apulia'],
};

const distancia = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let ant = Array.from({ length: b.length + 1 }, (_, i) => i), ant2 = null;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let melhor = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (ant2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], ant2[j - 2] + 1);
      melhor = Math.min(melhor, cur[j]);
    }
    if (melhor > max) return max + 1;
    ant2 = ant; ant = cur;
  }
  return ant[b.length];
};

export class Risolutore {
  constructor() {
    const { dados } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sito', 'data', 'comuni.json'), 'utf8'));
    const geo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sito', 'data', 'geo.json'), 'utf8'));
    this.prov = JSON.parse(fs.readFileSync(path.join(RAIZ, 'strumenti', 'dati', 'province.json'), 'utf8'));
    this.comuni = new Map(dados.map(([istat, nome, sigla, reg, , , pop]) => [istat, { istat, nome, sigla, reg, pop }]));
    this.porNome = new Map();
    for (const c of this.comuni.values()) this.porNome.set(c.nome, c);
    this.idx = new Map();
    this.fuzzy = new Map();
    const add = (k, istat, paraFuzzy = false) => {
      if (!k) return;
      for (const chave of k.includes(' ') ? [k, k.replace(/ /g, '')] : [k]) {   // também escrito junto: "sangiovanni"
        if (!this.idx.has(chave)) this.idx.set(chave, new Set());
        this.idx.get(chave).add(istat);
      }
      if (paraFuzzy && k.length >= 5) { const p = k[0]; if (!this.fuzzy.has(p)) this.fuzzy.set(p, new Set()); this.fuzzy.get(p).add(k); }
    };
    for (const c of this.comuni.values()) {
      for (const parte of c.nome.split('/')) {
        const toks = norm(parte).split(' ');
        add(toks.join(' '), c.istat, true);
        const sem = toks.filter(t => !STOP.has(t));
        add(sem.join(' '), c.istat, true);
        if (['san', 'santa', 'santo', 'sant', 'santi', 'santangelo'].includes(toks[0])) {
          add(['s', ...toks.slice(1)].join(' '), c.istat);
          add(['s', ...sem.slice(1)].join(' '), c.istat);
        }
      }
    }
    this.alias = new Map();
    for (const [k, nome] of Object.entries(ALIAS)) this.alias.set(k, nome ? this.porNome.get(nome)?.istat ?? null : null);
    this.regioni = new Map();
    for (const r of geo.regioni) {
      for (const n of [...r.nome.split('/'), r.nome.replace('/', ' ')]) this.regioni.set(norm(n), r.cod);
      for (const n of REG_EXTRA[r.cod] ?? []) this.regioni.set(n, r.cod);
    }
    // capoluogo de província: nome do comune = nome da província
    this.capoluogo = new Set([...this.comuni.values()].filter(c => this.prov[c.sigla] && norm(this.prov[c.sigla]).startsWith(norm(c.nome.split('/')[0]))).map(c => c.istat));
    this.cache = new Map();
  }

  risolvere(testo) {
    const k = testo ?? '';
    if (this.cache.has(k)) return this.cache.get(k);
    const r = this._risolvere(k);
    if (this.cache.size < 200000) this.cache.set(k, r);
    return r;
  }

  _risolvere(testo) {
    const limpo = testo.replace(/https?:\/\/\S+/g, ' ').replace(/@[\w.]+/g, ' ').replace(/#[\w]+/g, ' ');
    // siglas de província: só em maiúsculas ou entre parênteses ("NA", "(na)")
    const siglas = new Set();
    for (const m of limpo.matchAll(/(?:^|[\s,(\-])([A-Z]{2})(?=$|[\s,)\.!\-])/g)) if (this.prov[m[1]]) siglas.add(m[1]);
    for (const m of limpo.matchAll(/\(([a-zA-Z]{2})\)/g)) if (this.prov[m[1].toUpperCase()]) siglas.add(m[1].toUpperCase());
    const toks = norm(limpo).split(' ').filter(Boolean);
    if (!toks.length) return { istat: null, motivo: 'vuoto' };
    const originais = limpo.split(/[^\p{L}\p{N}']+/u).filter(Boolean);
    const maiuscula = t => originais.some(o => norm(o) === t && /^\p{Lu}/u.test(o));
    const significativos = toks.filter(t => !STOP.has(t) && !COMUNS.has(t)).length;

    const regs = new Set(), achados = [], usadoRegiao = new Set();
    for (let n = Math.min(6, toks.length); n >= 1; n--) {
      for (let i = 0; i + n <= toks.length; i++) {
        const g = toks.slice(i, i + n), k1 = g.join(' '), k2 = g.filter(t => !STOP.has(t)).join(' ');
        if (!k2) continue;
        const reg = this.regioni.get(k1) ?? this.regioni.get(k2);
        if (reg) { regs.add(reg); for (let j = i; j < i + n; j++) usadoRegiao.add(j); }
        let ids = this.idx.get(k1) ?? this.idx.get(k2) ?? (n > 1 ? this.idx.get(g.join('')) : null), tipo = 'esatto';
        const al = this.alias.has(k1) ? this.alias.get(k1) : this.alias.has(k2) ? this.alias.get(k2) : undefined;
        if (al !== undefined) { ids = al ? new Set([al]) : null; tipo = 'alias'; }
        if (ids) achados.push({ ids: [...ids], ini: i, fim: i + n, peso: k2.split(' ').length, tipo });
      }
    }
    // remove achados contidos em outros maiores; remove nomes que só são a região
    let cand = achados.filter(a => !achados.some(b => b !== a && b.ini <= a.ini && b.fim >= a.fim && b.fim - b.ini > a.fim - a.ini));
    cand = cand.filter(a => !(a.fim - a.ini === 1 && usadoRegiao.has(a.ini) && !this.comuni.get(a.ids[0])?.nome.match(/^aosta$/i)));
    const confirma = c => (regs.size && regs.has(c.reg)) || (siglas.size && siglas.has(c.sigla));
    // palavras comuns / comuni minúsculos sozinhos exigem confirmação
    cand = cand.filter(a => {
      if (a.peso > 1 || a.tipo === 'alias') return true;
      const t = toks[a.ini], cs = a.ids.map(id => this.comuni.get(id));
      if (cs.some(confirma)) return true;
      if (COMUNI_PAROLE.has(t) || COMUNS.has(t)) return maiuscula(t) && significativos <= 2;
      if (Math.max(...cs.map(c => c.pop)) < 3000) return maiuscula(t) || significativos <= 2;
      return true;
    });

    if (!cand.length) {
      const f = this.aproximar(toks, regs, siglas, maiuscula, significativos, 1, usadoRegiao);
      if (f) return f;
      return { istat: null, motivo: regs.size ? 'solo_regione' : 'nessuna_citta' };
    }

    // filtra por região/sigla mencionadas
    for (const a of cand) {
      const ok = a.ids.filter(id => confirma(this.comuni.get(id)));
      a.consistente = (regs.size || siglas.size) ? ok.length > 0 : true;
      if (ok.length) a.ids = ok;
    }
    // capoluogo citado junto com outra cidade da mesma província funciona como "província"
    if (cand.length > 1) {
      const outros = cand.filter(a => !(a.ids.length === 1 && this.capoluogo.has(a.ids[0]) && cand.some(b => b !== a && b.ids.some(id => this.comuni.get(id).sigla === this.comuni.get(a.ids[0]).sigla))));
      if (outros.length) cand = outros;
    }
    cand.sort((a, b) => (b.consistente - a.consistente) || (b.peso - a.peso) || (a.ini - b.ini));
    const top = cand[0];
    // a cidade exata não bate com a região citada ("Potenza Pciena, Marche"): tenta aproximar dentro da região
    if (!top.consistente) {
      const f = this.aproximar(toks, regs, siglas, maiuscula, significativos, 1, usadoRegiao);
      if (f) return f;
    }
    // sobrou palavra ao lado do nome achado ("Pieve di Cnto" achou só "Cento"): tenta um nome mais longo por aproximação
    const sobra = toks.filter((t, j) => !STOP.has(t) && !COMUNS.has(t) && !usadoRegiao.has(j) && !(j >= top.ini && j < top.fim)).length;
    if (sobra > 0 && top.tipo !== 'alias') {
      const f = this.aproximar(toks, regs, siglas, maiuscula, significativos, top.peso + 1, usadoRegiao);
      if (f && !top.ids.includes(f.istat)) return f;
    }
    const distintos = new Set(cand.filter(a => a.consistente === top.consistente && a.peso === top.peso).flatMap(a => a.ids));
    let ids = top.ids;
    if (ids.length > 1) {
      const cs = ids.map(id => this.comuni.get(id)).sort((a, b) => b.pop - a.pop);
      if (cs[0].pop >= 4 * cs[1].pop) ids = [cs[0].istat];
      else return { istat: null, motivo: 'omonimo', candidati: cs.map(c => `${c.nome} (${c.sigla})`) };
    }
    return { istat: ids[0], nome: this.comuni.get(ids[0]).nome, motivo: distintos.size > 1 ? 'piu_citta' : top.tipo };
  }

  // aproximação por erro de digitação: dos nomes mais longos (4 palavras) para os mais curtos
  aproximar(toks, regs, siglas, maiuscula = () => true, significativos = 1, minPalavras = 1, regiao = new Set()) {
    const confirmado = regs.size || siglas.size;
    for (let n = Math.min(4, toks.length); n >= 1; n--) {
      let melhor = null, md = Infinity, empate = false;
      for (let i = 0; i + n <= toks.length; i++) {
        const idxs = Array.from({ length: n }, (_, j) => i + j);
        if (idxs.every(j => regiao.has(j))) continue;
        const g = idxs.map(j => toks[j]).filter(t => !STOP.has(t));
        if (g.length < minPalavras || g.some(t => COMUNS.has(t))) continue;
        // só com alguma confiança: região/sigla citada, maiúscula ou comentário curto
        if (!confirmado && !maiuscula(g[0]) && significativos > 2) continue;
        const k = g.join(' ');
        if (k.length < 5) continue;
        const max = k.length >= 9 ? 2 : 1;
        for (const chave of this.fuzzy.get(k[0]) ?? []) {
          const d = distancia(k, chave, max);
          if (d > max) continue;
          let ids = [...this.idx.get(chave)];
          if (confirmado) ids = ids.filter(id => { const c = this.comuni.get(id); return regs.has(c.reg) || siglas.has(c.sigla); });
          if (!ids.length) continue;
          if (d < md) { md = d; melhor = ids; empate = false; } else if (d === md && ids.some(id => !melhor.includes(id))) empate = true;
        }
      }
      if (empate) return null;
      if (melhor) return melhor.length > 1 ? null : { istat: melhor[0], nome: this.comuni.get(melhor[0]).nome, motivo: 'fuzzy' };
    }
    return null;
  }
}

// "voto @fulano" / "voto fulano" -> conta votada
export function estrairVoto(testo) {
  const m = (testo ?? '').match(/\bvot[oa]\b\s*(?:per\s+)?@?([a-z0-9._]{2,30})/i);
  return m ? m[1].toLowerCase().replace(/\.$/, '') : null;
}
export const estrairTags = testo => [...new Set([...(testo ?? '').matchAll(/@([a-zA-Z0-9._]{1,30})/g)].map(m => m[1].toLowerCase().replace(/\.$/, '')))];
