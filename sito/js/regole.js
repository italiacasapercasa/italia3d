// Regras do jogo. Compartilhado entre o site e os scripts Node (sem DOM).
export const REGOLE = {
  versao: 'regola-2.0',
  // mecenate/misura: quem compra um negócio no mapa; só fazem a casa crescer, NÃO contam no mandato (eleições)
  punti: { casa: 10, commento: 5, extra: 1, tag: 3, recluta: 25, voto: 5, storia: 20, post: 20, mecenate: 100, misura: 50 },
  // extra e tag: por post; storia e post (no feed, marcando o perfil): por dia (fuso de Roma)
  limiti: { extra: 10, tag: 10, storia: 1, post: 1 },
  extra_attivo: true,          // false = comentar várias vezes no mesmo post não soma
  fiamme_h: 24,
  disputa_s: 120,              // duas casas na mesma cidade nova em menos de 2 min = "disputa"
  // mandato: de domingo 21:00 a domingo 21:00, hora de Roma
  mandato: { giorno: 0, ora: 21 },
  // derby da semana: um par por mandato, em rodízio (códigos ISTAT)
  derby: [
    ['058091', '015146'], // Roma × Milano
    ['063049', '001272'], // Napoli × Torino
    ['082053', '087015'], // Palermo × Catania
    ['010025', '037006'], // Genova × Bologna
    ['048017', '050026'], // Firenze × Pisa
    ['072006', '075035'], // Bari × Lecce
    ['027042', '023091'], // Venezia × Verona
  ],
  meta_passo: 5000,            // a meta global é o próximo múltiplo deste número de casas
  livelli: [
    { min: 0, nome: 'Casetta' },
    { min: 20, nome: 'Casa' },
    { min: 30, nome: 'Casa con giardino' },
    { min: 45, nome: 'Casa a due piani' },
    { min: 70, nome: 'Casa con garage' },
    { min: 100, nome: 'Casale' },
    { min: 140, nome: 'Casa con piscina' },
    { min: 190, nome: 'Residenza' },
    { min: 250, nome: 'Villa' },
    { min: 330, nome: 'Villa di lusso' },
    { min: 600, nome: 'Torre' },
    { min: 900, nome: 'Grattacielo' },
    { min: 1300, nome: 'Masseria' },
    { min: 1900, nome: 'Palazzo' },
    { min: 2800, nome: 'La vetta della mappa' },
  ],
  // ordem de distribuição: de cima para baixo, um cargo por pessoa
  cariche: ['presidente', 'senatore', 'presidente_regione', 'deputato', 'sindaco', 'consigliere'],
  posti: { presidente: 1, senatoriPerRegione: 3, deputati: 400, deputatiMinimo: 2, consiglieri: 10 },
  // traguardi della città: [id, case, emoji, nome, com artigo]. Os prédios entram nas quadras especiais (antes parque):
  // nenhuma casa muda de lugar. Quem traz a N-ésima casa "costruisce" o prédio (ver traguardi.js)
  traguardi: [
    ['chiesa', 30, '⛪', 'Chiesa', 'la chiesa'],
    ['fontana', 50, '⛲', 'Fontana monumentale', 'la fontana monumentale'],
    ['palazzina', 100, '🏢', 'Prima palazzina', 'la prima palazzina'],
    ['scuola', 150, '🏫', 'Scuola', 'la scuola'],
    ['stazione', 250, '🚉', 'Stazione', 'la stazione'],
    ['campo', 400, '⚽', 'Campo da calcio', 'il campo da calcio'],
    ['ospedale', 500, '🏥', 'Ospedale', 'l’ospedale'],
    ['stadio', 1000, '🏟️', 'Stadio', 'lo stadio'],
  ],
  palazzinaOgni: 100,          // depois do ospedale: mais uma palazzina a cada 100 case (600, 700, ...)
  // lotes livres desenhados depois da última casa (só desenho: convite para marcar amigos)
  lotti_liberi: 3,
  cartellone_da: 15,           // cidades com pelo menos estas casas mostram um outdoor "LA TUA PUBBLICITÀ QUI"
  // Natal na piazza (mês-dia, hora de Roma): árvore e luminárias
  natale: { da: '11-28', a: '01-06' },
  halloween: { da: '10-27', a: '10-31' },
};

// Halloween: abóboras nas casas e na piazza (?halloween=1 / ?halloween=0 forçam nos testes)
export function halloweenAttivo(ts = Date.now()) {
  const f = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('halloween') : null;
  if (f !== null) return f !== '0';
  const md = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }).slice(5);
  return md >= REGOLE.halloween.da && md <= REGOLE.halloween.a;
}

// o Natal está ativo nesta data? (?natale=1 / ?natale=0 forçam nos testes)
export function nataleAttivo(ts = Date.now()) {
  const f = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('natale') : null;
  if (f !== null) return f !== '0';
  const md = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }).slice(5);
  const { da, a } = REGOLE.natale;
  return da <= a ? md >= da && md <= a : md >= da || md <= a;
}

export const NOMI_CARICHE = {
  presidente: 'Presidente del Consiglio',
  senatore: 'Senatore/Senatrice',
  presidente_regione: 'Presidente di Regione',
  deputato: 'Deputato/a',
  sindaco: 'Sindaco/a',
  consigliere: 'Consigliere/a comunale',
};

export const DESCR_CARICHE = {
  presidente: "1 per tutta l'Italia · eletto/a la domenica alle 21",
  senatore: '3 per regione',
  presidente_regione: '1 per regione',
  deputato: '400, divisi per popolazione (minimo 2 per regione)',
  sindaco: '1 per comune · eletto/a la domenica alle 21',
  consigliere: '10 per comune',
};

// ordem igual ao array "fonti" de cada casa no snapshot
export const FONTI = [
  ['casa', 'Casa', '#FFC93C'],
  ['commento', 'Commenti nei post', '#4FB6FF'],
  ['extra', 'Commenti extra', '#A7D8FF'],
  ['tag', 'Amici taggati', '#3DDC97'],
  ['recluta', 'Amici entrati', '#1F9D6B'],
  ['voto', 'Voti ricevuti', '#E0473C'],
  ['storia', 'Storie con il nostro @', '#FF8A00'],
  ['post', 'Post con il nostro @', '#D94F8A'],
  ['mecenate', 'Attività sulla mappa', '#6C4FD3'],
];

export const COME_GUADAGNARE = p => [
  ['commento', 'Commentare nei post', `+${p.commento} per post`],
  ['extra', 'Commenti extra', `+${p.extra} (fino a 10)`],
  ['tag', 'Taggare amici', `+${p.tag} per amico (fino a 10)`],
  ['recluta', 'Amici che entrano', `+${p.recluta} quando un amico taggato prende casa`],
  ['voto', 'Voti ricevuti', `+${p.voto} (1 a persona per post)`],
  ['storia', 'Storia con il nostro @', `+${p.storia} (1 al giorno) e casa in fiamme 24 h`],
  ['post', 'Post nel feed con il nostro @', `+${p.post} (1 al giorno): tagga @italiacasapercasa nella foto`],
  ['mecenate', 'Metti la tua attività sulla mappa', `+${p.mecenate} (+${p.misura} su misura) e badge Mecenate: fanno crescere la casa, ma non contano per le elezioni`],
  ['casa', 'Avere una casa', `+${p.casa}, una volta`],
];

export function livelloDi(punti) {
  let n = 0;
  for (let i = 0; i < REGOLE.livelli.length; i++) if (punti >= REGOLE.livelli[i].min) n = i;
  return n;
}

// formatação italiana, fuso de Roma
// separador de milhar sempre ("6.966"): o it-IT do navegador não separa números de 4 dígitos
export const num = n => {
  const [int, dec] = Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: false }).split(',');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? `,${dec}` : '');
};
export const punti = n => `${num(n)} ${n === 1 ? 'punto' : 'punti'}`;
const FUSO = { timeZone: 'Europe/Rome' };
export const dataBreve = ts => new Date(ts).toLocaleDateString('it-IT', { ...FUSO, day: 'numeric', month: 'long' });
export const dataLunga = ts => new Date(ts).toLocaleDateString('it-IT', { ...FUSO, weekday: 'long', day: 'numeric', month: 'long' });
export const ora = ts => new Date(ts).toLocaleTimeString('it-IT', { ...FUSO, hour: '2-digit', minute: '2-digit' });
