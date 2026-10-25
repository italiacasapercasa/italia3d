// Testes das regras do motor com eventos montados à mão.
// Uso: node strumenti/teste-motore.mjs
import { calcolare } from './motore.mjs';
import { daRoma } from '../sito/js/tempo.js';

const comuni = [['058091', 'Roma', 'RM', '12', 0, 0, 2800000], ['015146', 'Milano', 'MI', '03', -270, -380, 1400000]];
const regioni = [{ cod: '12', nome: 'Lazio', pop: 5700000 }, { cod: '03', nome: 'Lombardia', pop: 10000000 }];
const qui = daRoma(2026, 10, 15, 14), H = 3600e3;          // quinta 15/10, 14h Roma
const dom21 = daRoma(2026, 10, 18, 21);                     // fim do mandato 1
const c = (conta, ts, extra = {}) => ({ post: 'p1', conta, ts, luogo: null, tags: [], voto: null, stato: 'valido', ...extra });

const eventi = {
  inizio: qui,
  posts: [{ id: 'p1', ts: qui }, { id: 'p2', ts: dom21 + H }],
  commenti: [
    c('anna', qui + 1e3, { luogo: '058091' }),                        // casa 10 + commento 5, fundadora de Roma
    c('bruno', qui + 30e3, { luogo: '058091' }),                      // 30 s depois: disputa
    ...Array.from({ length: 12 }, (_, i) => c('anna', qui + 2e3 + i)), // extras: só 10 contam
    c('anna', qui + 5 * H, { tags: ['carla', 'carla', 'anna', 'dario'] }), // carla e dario: +3 cada (repetida e a própria não contam)
    c('carla', qui + 6 * H, { luogo: '015146' }),                     // carla entra: anna ganha +25
    c('dario', qui + 7 * H, { luogo: '015146' }),                     // dario entra: anna ganha +25
    c('bruno', qui + 8 * H, { voto: 'anna' }),                        // voto +5 para anna
    c('bruno', qui + 9 * H, { voto: 'anna' }),                        // segundo voto no mesmo post: não conta
    c('carla', qui + 9 * H, { voto: 'carla' }),                       // votar em si mesma: não conta
    c('eva', qui + 10 * H, { luogo: '058091' }),                      // bloqueada: lote reservado, casa escondida
    c('fabio', qui + 11 * H),                                         // sem cidade: não ganha casa
    c('gino', qui + 12 * H, { stato: 'rifiutato', luogo: '058091' }),
    { post: 'p2', conta: 'bruno', ts: dom21 + 2 * H, luogo: null, tags: [], voto: null, stato: 'valido' }, // mandato 2
  ],
  storie: [
    { conta: 'bruno', ts: qui + 13 * H }, { conta: 'bruno', ts: qui + 14 * H },  // mesmo dia: só +20 uma vez
    { conta: 'carla', ts: daRoma(2026, 10, 17, 12) },                           // dia em dobro: +40
    { conta: 'fabio', ts: qui + 15 * H },                                       // sem casa: ignorada
    { conta: 'dario', ts: dom21 + H },                                          // 2 h antes de "agora": em chamas
  ],
  bloccati: ['eva'],
  doppi: [{ da: daRoma(2026, 10, 17, 0), a: daRoma(2026, 10, 18, 0), tipi: ['storia'] }],
};

const agora = dom21 + 3 * H;
const s = calcolare({ eventi, comuni, regioni, agora });
const casa = conta => s.case.find(x => x[0] === conta);
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) falhas++; };

ok(casa('anna')[4] === 10 + 5 + 10 + 6 + 50 + 5, `anna: casa+commento+10 extras+2 tags+2 recrute+1 voto = 86 (deu ${casa('anna')[4]})`);
ok(JSON.stringify(casa('anna')[7]) === JSON.stringify([10, 5, 10, 6, 50, 5, 0]), `anna: fontes ${JSON.stringify(casa('anna')[7])}`);
ok(casa('bruno')[4] === 10 + 5 + 2 + 20 + 5, `bruno: casa+commento+2 extras (votos)+1 storia+commento no mandato 2 = 42 (deu ${casa('bruno')[4]})`);
ok(casa('bruno')[5] === 5, `bruno: pontos do mandato 2 = 5 (deu ${casa('bruno')[5]})`);
ok(casa('bruno')[6] === 0, 'bruno: chamas apagadas (story há mais de 24 h)');
ok(casa('dario')[6] > 0, 'dario: casa em chamas (story há 2 h)');
ok(casa('carla')[4] === 10 + 5 + 1 + 40, `carla: casa+commento+1 extra+storia em dia dobrado = 56 (deu ${casa('carla')[4]})`);
ok(!casa('eva') && !casa('fabio') && !casa('gino'), 'eva (bloqueada), fabio (sem cidade) e gino (rejeitado) sem casa visível');
const roma = s.luoghi.find(l => l[0] === 0);
ok(roma[1] === 2 && roma[4] === 3 && roma[2] === 'anna', `Roma: 2 casas visíveis, 3 lotes, fundadora anna (${JSON.stringify(roma)})`);
ok(s.eventi.some(e => e.tipo === 'disputa' && e.secondo === 'bruno' && e.differenza_s === 29), 'evento de disputa anna × bruno (29 s)');
ok(s.mandato.n === 2, `mandato atual = 2 (deu ${s.mandato.n})`);
ok(s.cariche.presidente?.conta === 'anna', `presidente eleito no domingo = anna (deu ${s.cariche.presidente?.conta})`);
ok(s.cariche.sindaci['015146']?.conta === 'carla', `sindaca de Milano = carla (deu ${s.cariche.sindaci['015146']?.conta})`);
ok(s.cariche.leader?.conta === 'dario', `líder do mandato 2 = dario, story +20 (deu ${s.cariche.leader?.conta})`);
ok(s.contatori.commenti_rifiutati === 1 && s.contatori.case_nascoste === 1, 'contadores: 1 rejeitado, 1 casa escondida');
console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
