// Testa sito/api/webhook.php e storie.php num servidor PHP local (php -S localhost:5188 -t sito).
// Precisa de privato/config.php com APP_SECRET='segreto_di_prova', VERIFY_TOKEN='verifica_di_prova', CHIAVE_DOWNLOAD='chiave_di_prova'.
import { createHmac } from 'node:crypto';

const B = 'http://localhost:5188/api';
let falhas = 0;
const ok = (c, m) => { console.log(`${c ? '✔' : '✘'} ${m}`); if (!c) falhas++; };
const assinar = corpo => 'sha256=' + createHmac('sha256', 'segreto_di_prova').update(corpo).digest('hex');
const post = (corpo, sig = assinar(corpo)) => fetch(`${B}/webhook.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body: corpo });

let r = await fetch(`${B}/webhook.php?hub.mode=subscribe&hub.verify_token=verifica_di_prova&hub.challenge=12345`);
ok(r.status === 200 && (await r.text()) === '12345', 'verificação da Meta devolve o hub.challenge');
r = await fetch(`${B}/webhook.php?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1`);
ok(r.status === 403, 'verify_token errado: 403');

const story = JSON.stringify({ object: 'instagram', entry: [{ id: '1', time: 1, messaging: [{ sender: { id: 'IGSID_42' }, recipient: { id: '1' }, timestamp: 1792900000000, message: { mid: 'MID_A', attachments: [{ type: 'story_mention', payload: { url: 'https://cdn.example/story' } }] } }] }] });
r = await post(story, 'sha256=falsa');
ok(r.status === 403, 'assinatura falsa: 403');
r = await post(story);
ok(r.status === 200, 'story_mention assinada: 200');
const texto = JSON.stringify({ object: 'instagram', entry: [{ messaging: [{ sender: { id: 'IGSID_7' }, timestamp: 1, message: { mid: 'MID_B', text: 'ciao' } }] }] });
r = await post(texto);
ok(r.status === 200, 'mensagem comum: 200 (ignorada)');

r = await fetch(`${B}/storie.php?chiave=errada`);
ok(r.status === 403, 'download com chave errada: 403');
r = await fetch(`${B}/storie.php?chiave=chiave_di_prova`);
const linhas = (await r.text()).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
ok(linhas.length === 1 && linhas[0].mid === 'MID_A' && linhas[0].igsid === 'IGSID_42' && linhas[0].ts === 1792900000000, `storie.jsonl: ${JSON.stringify(linhas)}`);
console.log(falhas ? `${falhas} falha(s)` : 'todos os testes passaram');
process.exit(falhas ? 1 : 0);
