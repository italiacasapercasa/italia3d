// Testes do resolvedor de cidades.
// Uso: node strumenti/teste-risolutore.mjs
import { Risolutore, estrairVoto, estrairTags } from './risolutore.mjs';

const r = new Risolutore();
let falhas = 0;
const caso = (txt, esperado) => {
  const t0 = performance.now(), res = r.risolvere(txt), ms = performance.now() - t0;
  const nome = res.istat ? `${res.nome} (${r.comuni.get(res.istat).sigla})` : null;
  const ok = esperado === null ? res.istat === null : nome === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? '✔' : '✘'} ${JSON.stringify(txt).padEnd(44)} → ${nome ?? `— ${res.motivo}${res.candidati ? ` [${res.candidati.join(', ')}]` : ''}`}${ok ? '' : `   (esperado: ${esperado ?? 'nada'})`}${ms > 50 ? ` ${ms.toFixed(0)}ms` : ''}`);
};

// básicos
caso('Napoli, Campania', 'Napoli (NA)');
caso('napoli', 'Napoli (NA)');
caso('Roma 🇮🇹🔥', 'Roma (RM)');
caso('Milano Lombardia ❤️', 'Milano (MI)');
caso('Sono di Torre del Greco (NA)', 'Torre del Greco (NA)');
caso('torre del greco napoli', 'Torre del Greco (NA)');
caso('Paternò, Catania', 'Paternò (CT)');
caso('Catania Paternò', 'Paternò (CT)');
caso('Bari', 'Bari (BA)');
caso('vivo a Sesto San Giovanni', 'Sesto San Giovanni (MI)');
// acentos, apóstrofos, preposições
caso('forli', 'Forlì (FC)');
caso("L'Aquila, Abruzzo", "L'Aquila (AQ)");
caso('Laquila', "L'Aquila (AQ)");
caso('La Spezia', 'La Spezia (SP)');
caso('Reggio Calabria', 'Reggio di Calabria (RC)');
caso('Reggio Emilia', "Reggio nell'Emilia (RE)");
caso('Bolzano', 'Bolzano (BZ)');
caso('Bozen Südtirol', 'Bolzano (BZ)');
caso('S. Giovanni Rotondo', 'San Giovanni Rotondo (FG)');
caso('sangiovanni rotondo', 'San Giovanni Rotondo (FG)');
// inglês, frações, apelidos
caso('Rome', 'Roma (RM)');
caso('Florence Italy', 'Firenze (FI)');
caso('Ostia', 'Roma (RM)');
caso('Mestre', 'Venezia (VE)');
caso('napule è', 'Napoli (NA)');
// erros de digitação
caso('Palermoo', 'Palermo (PA)');
caso('Caltanisseta', 'Caltanissetta (CL)');
caso('Civitavechia', 'Civitavecchia (RM)');
// homônimos
caso('Calliano', null);
caso('Calliano, Trentino', 'Calliano (TN)');
caso('Castro (LE)', 'Castro (LE)');
caso('Castro Puglia', 'Castro (LE)');
// palavras comuns que também são comuni
caso('che bella la mia città', null);
caso('Noto, Sicilia', 'Noto (SR)');
caso('forza ragazzi, ci siamo', null);
caso('vita bella', null);
// só região / nada
caso('Lombardia', null);
caso('Sicilia ❤️', null);
caso('🔥🔥🔥', null);
caso('@amico guarda qui', null);

// votos e marcações
const v = (txt, esp) => { const x = estrairVoto(txt); const ok = x === esp; if (!ok) falhas++; console.log(`${ok ? '✔' : '✘'} voto ${JSON.stringify(txt)} → ${x}`); };
v('voto @giulia_rossi', 'giulia_rossi');
v('Voto per @Marco.Bianchi!', 'marco.bianchi');
v('ho votato ieri', null);
const tg = estrairTags('ciao @Anna_1 @luca.b. e @anna_1');
const okT = JSON.stringify(tg) === JSON.stringify(['anna_1', 'luca.b']);
if (!okT) falhas++;
console.log(`${okT ? '✔' : '✘'} tags → ${JSON.stringify(tg)}`);

// desempenho
const t0 = performance.now();
for (let i = 0; i < 2000; i++) r._risolvere(`sono di comune numero ${i} Milano`);
console.log(`\n2000 textos novos: ${(performance.now() - t0).toFixed(0)} ms`);
console.log(falhas ? `${falhas} falha(s)` : 'todos os testes passaram');
process.exit(falhas ? 1 : 0);
