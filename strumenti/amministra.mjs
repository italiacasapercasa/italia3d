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

  Lojas e outdoors (pedidos feitos em negozio.html):
  negozi [tutti]                         pedidos novos (baixa do servidor); "tutti" mostra também os já tratados
  vedi <id>                              detalhes de um pedido
  approva <id> [giorni]                  põe no mapa (padrão: data/negozio.json durata_giorni) — reserva um lote fixo
  rifiuta <id>                           recusa o pedido (devolva o pagamento na Hotmart, se houve)
  rinnova <id> [giorni]                  prolonga um comércio aprovado
  rimuovi <id>                           tira do mapa agora (o lote continua reservado: nenhuma casa muda de lugar)
  commerci                               comércios aprovados e até quando ficam

  Casas decoradas (decori.js; pagas pela Hotmart, ligam sozinhas):
  decori [tutti]                         decorações ativas; "tutti" mostra também não pagas, vencidas e removidas
  decori rimuovi <id>                    desliga agora (ex.: quem ganhou o presente pediu para tirar)
  decori omaggio <conta> <efeitos> [da]  decoração grátis (testes, vídeos, compensação); efeitos separados por vírgula,
                                         ex.: nerazzurro,corona,neon  (time: bianconero nerazzurro rossonero azzurro giallorosso
                                         biancoceleste viola granata rossoblu; efeitos: oro neon corona fuochi campione palloncini tricolore cornice)

  lista                                  inscritos na lista de espera do "Crea video così"
  visite [dias]                          visitas do site por dia (contador anônimo; padrão: 7 dias)
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
      console.log(`ok: @${conta.replace(/^@/, '')} → ${c.nome} (${c.sigla}) (se já tem casa, ela muda para essa cidade na próxima atualização)`);
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
    case 'negozi': case 'vedi': case 'approva': case 'rifiuta': {
      const { conectar } = await import('./pubblica.mjs');
      const ftp = conectar(() => {}), remoto = `${ftp.priv}dati/negozi/`, local = path.join(RAIZ, 'dati-grezzi', 'negozi');
      const baixarPedido = id => {
        if (!/^\d{6}-[0-9a-f]{8}$/.test(id ?? '')) throw new Error('id inválido (ex.: 261025-1a2b3c4d)');
        if (!ftp.baixar(`${remoto}${id}.json`, path.join(local, `${id}.json`))) throw new Error(`pedido ${id} não encontrado no servidor`);
        return ler(path.join(local, `${id}.json`), null);
      };
      const salvarPedido = p => { gravar(path.join(local, `${p.id}.json`), p); ftp.enviar([{ local: path.join(local, `${p.id}.json`), remoto: `${remoto}${p.id}.json` }]); };
      const r = new Risolutore(), nomeCom = ist => { const c = r.comuni.get(ist); return c ? `${c.nome} (${c.sigla})` : ist; };
      // até onde a pessoa chegou: pagou / abandonou dentro da Hotmart / clicou em pagar / só preencheu; sem pagar há 48 h = scaduto
      const scaduto = p => p.pagamento !== 'pagato' && Date.now() - Date.parse(p.creato) > 48 * 3600e3;
      const fase = p => p.pagamento ?? (p.checkout === 'abbandonato' ? '🛒 carrello' : p.clic_pagamento ? '💳 cliccato' : scaduto(p) ? '⌛ scaduto' : 'non pagato');
      const linhaPedido = p => `${p.id}  ${p.stato.padEnd(9)} ${fase(p).padEnd(11)} ${p.prodotto === 'cartellone' ? '📣' : '🏪'} ${p.nome} · ${nomeCom(p.istat)} · ${p.email}${p.su_misura ? ` · SU MISURA (${p.pagamento_su_misura ?? 'non pagato'})` : ''}`;
      if (cmd === 'negozi') {
        const ids = ftp.listar(remoto).filter(n => /^\d{6}-[0-9a-f]{8}\.json$/.test(n)).map(n => n.slice(0, -5)).sort();
        const lista = ids.map(id => { ftp.baixar(`${remoto}${id}.json`, path.join(local, `${id}.json`)); return ler(path.join(local, `${id}.json`), null); }).filter(Boolean);
        const mostrar = args[0] === 'tutti' ? lista : lista.filter(p => p.stato === 'nuovo' && !scaduto(p));
        console.log(mostrar.length ? mostrar.map(linhaPedido).join('\n') : `Nenhum pedido ${args[0] === 'tutti' ? '' : 'novo '}(${lista.length} no total).`);
        const n = lista.filter(p => p.stato === 'nuovo' && scaduto(p)).length;
        if (args[0] !== 'tutti' && n) console.log(`(+${n} sem pagamento há mais de 48 h: "negozi tutti" mostra)`);
        break;
      }
      const p = baixarPedido(args[0]);
      if (cmd === 'vedi') { console.log(linhaPedido(p)); console.log(JSON.stringify({ ...p, logo: p.logo || '(sem logo)' }, null, 2)); break; }
      if (cmd === 'rifiuta') { p.stato = 'rifiutato'; salvarPedido(p); console.log(`ok: ${p.id} recusado${p.pagamento === 'pagato' ? ' · ATENÇÃO: está pago, faça o reembolso na Hotmart' : ''}`); break; }
      // approva: confere vagas, publica o logo e acrescenta em config/commerci.json
      const cfgNeg = ler(path.join(RAIZ, 'sito', 'data', 'negozio.json'), {}), com = r.comuni.get(p.istat);
      if (!com) throw new Error(`comune ${p.istat} não existe`);
      const lista = ler(path.join(CFG, 'commerci.json'), []);
      if (lista.some(x => x.id === p.id)) throw new Error(`${p.id} já está aprovado (use rinnova)`);
      const piano = cfgNeg.piani.find(x => com.pop >= x.da) ?? cfgNeg.piani.at(-1);
      const ativos = lista.filter(x => x.istat === p.istat && (x.prodotto ?? 'negozio') === p.prodotto && Date.parse(x.fino) > Date.now()).length;
      if (ativos >= piano.posti[p.prodotto]) throw new Error(`${com.nome} já tem ${ativos}/${piano.posti[p.prodotto]} ${p.prodotto} ativos`);
      if (p.pagamento !== 'pagato') console.log('aviso: a Hotmart ainda não confirmou o pagamento deste pedido');
      if (p.su_misura && p.pagamento_su_misura !== 'pagato') console.log('aviso: o adicional «su misura» ainda não foi pago (a loja entra com a personalização mesmo assim; use rimuovi/approva de novo se preciso)');
      let logo = '';
      if (p.logo) {
        const arq = path.join(RAIZ, 'sito', 'data', 'loghi', p.logo);
        if (ftp.baixar(`${remoto}${p.logo}`, arq)) { ftp.enviar([{ local: arq, remoto: `${ftp.web}data/loghi/${p.logo}` }]); logo = `data/loghi/${p.logo}`; }
        else console.log('aviso: não consegui baixar o logo; vai sem logo');
      }
      const giorni = +(args[1] ?? cfgNeg.durata_giorni ?? 30), agora = new Date();
      lista.push({
        id: p.id, istat: p.istat, approvato: agora.toISOString(), fino: new Date(agora.getTime() + giorni * 86400e3).toISOString(),
        prodotto: p.prodotto, nome: p.nome, tipo: p.tipo, colore: p.colore, whatsapp: p.whatsapp, instagram: p.instagram,
        descrizione: p.descrizione, testo: p.testo, logo,
        ...(p.su_misura && p.stile ? { stile: p.stile } : {}),
        ...(p.giocatore ? { giocatore: p.giocatore } : {}),   // casa do comprador: +100 (+50 su misura) e badge Mecenate
      });
      gravar(path.join(CFG, 'commerci.json'), lista);
      p.stato = 'approvato'; p.approvato = agora.toISOString();
      salvarPedido(p);
      console.log(`ok: ${p.nome} aprovado em ${com.nome} por ${giorni} dias (aparece na próxima atualização do mapa)`);
      break;
    }
    case 'rinnova': case 'rimuovi': {
      const lista = ler(path.join(CFG, 'commerci.json'), []), x = lista.find(n => n.id === args[0]);
      if (!x) throw new Error(`${args[0]} não está entre os comércios aprovados`);
      // nunca apagar da lista: o lote reservado precisa continuar existindo, senão as casas seguintes mudam de lugar
      if (cmd === 'rimuovi') x.fino = new Date().toISOString();
      else x.fino = new Date(Math.max(Date.parse(x.fino), Date.now()) + +(args[1] ?? 30) * 86400e3).toISOString();
      gravar(path.join(CFG, 'commerci.json'), lista);
      console.log(`ok: ${x.nome} ${cmd === 'rimuovi' ? 'sai do mapa na próxima atualização' : `fica até ${new Date(x.fino).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`}`);
      break;
    }
    case 'decori': {
      const { conectar } = await import('./pubblica.mjs');
      const ftp = conectar(() => {}), remoto = `${ftp.priv}dati/decori/`, local = path.join(RAIZ, 'dati-grezzi', 'decori');
      fs.mkdirSync(local, { recursive: true });
      const ids = () => ftp.listar(remoto).filter(n => /^\d{6}-[0-9a-f]{8}\.json$/.test(n)).map(n => n.slice(0, -5)).sort();
      const baixar = id => (ftp.baixar(`${remoto}${id}.json`, path.join(local, `${id}.json`)) ? ler(path.join(local, `${id}.json`), null) : null);
      const salvar = p => { gravar(path.join(local, `${p.id}.json`), p); ftp.enviar([{ local: path.join(local, `${p.id}.json`), remoto: `${remoto}${p.id}.json` }]); };
      const ativa = p => ['pagato', 'omaggio'].includes(p.pagamento) && p.stato !== 'rimosso' && Date.parse(p.scade) > Date.now();
      // mesma regra do rigeneraDecori de api/hotmart.php: a compra ativa mais recente de cada conta vale
      const rigenera = lista => {
        const por = new Map();
        for (const p of lista.filter(ativa)) if (!por.has(p.conta) || p.attivo_da > por.get(p.conta).attivo_da) por.set(p.conta, p);
        const pub = { agg: new Date().toISOString(), decori: [...por.values()].map(p => ({ id: p.id, conta: p.conta, da: p.da ?? '', squadra: p.squadra ?? '', extra: p.extra ?? [], scade: p.scade })) };
        const arq = path.join(local, 'decori-pubblico.json');
        fs.writeFileSync(arq, JSON.stringify(pub));
        ftp.enviar([{ local: arq, remoto: `${ftp.web}data/decori.json` }]);
        console.log(`lista pública atualizada: ${pub.decori.length} casa(s) decorada(s) no mapa`);
      };
      const quando = s => new Date(s).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });
      const linha = p => `${p.id}  ${(ativa(p) ? `✨ até ${quando(p.scade)}` : p.stato === 'rimosso' ? '✖ removida' : p.scade ? '⌛ vencida' : `${p.pagamento ?? 'não pagou'}`).padEnd(24)} @${p.conta}${p.da ? ` 🎁 da @${p.da}` : ''} · ${[p.squadra, ...(p.extra ?? [])].filter(Boolean).join(', ')}`;
      if (args[0] === 'rimuovi') {
        const p = baixar(args[1] ?? '');
        if (!p) throw new Error(`decoração ${args[1]} não encontrada no servidor`);
        p.stato = 'rimosso'; p.rimosso = new Date().toISOString();
        salvar(p);
        rigenera(ids().map(baixar).filter(Boolean));
        console.log(`ok: @${p.conta} sem decoração${p.pagamento === 'pagato' ? ' (se for reembolsar, faça na Hotmart)' : ''}`);
        break;
      }
      if (args[0] === 'omaggio') {
        const conta = (args[1] ?? '').replace(/^@/, '').toLowerCase(), sel = (args[2] ?? '').split(',').filter(Boolean), da = (args[3] ?? '').replace(/^@/, '').toLowerCase();
        const SQ = ['bianconero', 'nerazzurro', 'rossonero', 'azzurro', 'giallorosso', 'biancoceleste', 'viola', 'granata', 'rossoblu'];
        const EF = ['oro', 'neon', 'corona', 'fuochi', 'campione', 'palloncini', 'tricolore', 'cornice'];
        const snap = ler(path.join(RAIZ, 'sito', 'data', 'snapshot.json'), { case: [] }), conte = new Set(snap.case.map(c => c[0]));
        if (!conte.has(conta)) throw new Error(`@${conta} não tem casa no mapa`);
        if (da && !conte.has(da)) throw new Error(`@${da} não tem casa no mapa`);
        const ruins = sel.filter(x => !SQ.includes(x) && !EF.includes(x));
        if (!sel.length || ruins.length) throw new Error(`efeitos inválidos: ${ruins.join(', ') || '(nenhum)'}`);
        const giorni = ler(path.join(RAIZ, 'sito', 'data', 'negozio.json'), {}).decora?.giorni ?? 10, agora = new Date();
        const p = {
          id: `${agora.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`, creato: agora.toISOString(), stato: 'nuovo',
          modo: da ? 'regalo' : 'mia', conta, da, squadra: sel.find(x => SQ.includes(x)) ?? '', extra: sel.filter(x => EF.includes(x)),
          pagamento: 'omaggio', attivo_da: agora.toISOString(), scade: new Date(agora.getTime() + giorni * 86400e3).toISOString(),
        };
        salvar(p);
        rigenera(ids().map(baixar).filter(Boolean));
        console.log(`ok: ${linha(p)}`);
        break;
      }
      const lista = ids().map(baixar).filter(Boolean);
      const mostrar = args[0] === 'tutti' ? lista : lista.filter(ativa);
      console.log(mostrar.length ? mostrar.map(linha).join('\n') : `Nenhuma decoração ${args[0] === 'tutti' ? '' : 'ativa '}(${lista.length} pedido(s) no total).`);
      if (args[0] !== 'tutti') {
        const pagas = lista.filter(p => p.pagamento === 'pagato').length, abertas = lista.filter(p => !p.pagamento).length;
        console.log(`(${pagas} paga(s) no total · ${abertas} pedido(s) que não chegaram a pagar)`);
      }
      break;
    }
    case 'lista': {
      const { conectar } = await import('./pubblica.mjs');
      const ftp = conectar(() => {}), local = path.join(RAIZ, 'dati-grezzi', 'lista-attesa.jsonl');
      if (!ftp.baixar(`${ftp.priv}dati/lista-attesa.jsonl`, local)) { console.log('Ninguém se inscreveu ainda.'); break; }
      const l = fs.readFileSync(local, 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x));
      console.log(`${l.length} inscritos:`);
      for (const x of l) console.log(`  ${x.em.slice(0, 16).replace('T', ' ')}  ${x.email}${x.conta ? `  @${x.conta}` : ''}`);
      break;
    }
    case 'visite': {
      // um arquivo por dia no servidor (privato/dati/visite/AAAA-MM-DD.json), só totais
      const { conectar } = await import('./pubblica.mjs');
      const ftp = conectar(() => {}), local = path.join(RAIZ, 'dati-grezzi', 'visite');
      const dias = ftp.listar(`${ftp.priv}dati/visite/`).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().slice(-(+(args[0] ?? 7)));
      if (!dias.length) { console.log('Nenhuma visita registrada ainda.'); break; }
      const top = o => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
      for (const n of dias) {
        ftp.baixar(`${ftp.priv}dati/visite/${n}`, path.join(local, n));
        const s = ler(path.join(local, n), {});
        const pct = s.visite ? Math.round(100 * s.caricate / (s.pagine?.mappa || s.visite)) : 0;
        const pico = Object.entries(s.ore ?? {}).sort((a, b) => b[1] - a[1])[0];
        console.log(`${n.slice(0, 10)}  ${String(s.visite).padStart(6)} visitas · ${String(s.unici).padStart(6)} únicos · mapa abriu em ${pct}% · pico ${pico ? `${pico[0]}h (${pico[1]})` : '—'}`);
        console.log(`            páginas: ${top(s.pagine)}\n            origem: ${top(s.fonti)}\n            aparelho: ${top(s.dispositivi)}`);
      }
      break;
    }
    case 'commerci': {
      const lista = ler(path.join(CFG, 'commerci.json'), []), r = new Risolutore();
      console.log(lista.length ? lista.map(x => `${x.id}  ${Date.parse(x.fino) > Date.now() ? 'no mapa até' : 'expirou em'} ${new Date(x.fino).toLocaleDateString('it-IT')}  ${x.prodotto === 'cartellone' ? '📣' : '🏪'} ${x.nome} · ${r.comuni.get(x.istat)?.nome ?? x.istat}`).join('\n') : 'Nenhum comércio aprovado.');
      break;
    }
    default:
      console.log(AJUDA);
  }
  // mudou alguma configuração do jogo: envia para o servidor (o robô do GitHub usa a de lá)
  const muda = ['correggi', 'assegna', 'blocca', 'sblocca', 'storia', 'approva', 'rinnova', 'rimuovi'].includes(cmd) || (cmd === 'doppi' && args[0] !== 'lista');
  if (muda && fs.existsSync(path.join(CFG, 'hostinger.json'))) {
    try { (await import('./pubblica.mjs')).pubblicare({ config: true, log: () => {} }); console.log('configuração enviada ao servidor (vale na próxima atualização automática)'); }
    catch (e) { console.log(`aviso: não consegui enviar ao servidor (${e.message}); rode "node strumenti/pubblica.mjs --config" depois`); }
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
}
