# Especificação do jogo — versão Itália

Base: engenharia reversa de mexicoseconstruye.explicatech3d.com (snapshot "snap-0025", regra "regra-2.6", 22/10/2026).
O código será escrito do zero. Nada do bundle deles é copiado.

## 1. Mecânica central

- A pessoa comenta "cidade, região" num post do perfil.
- O sistema resolve o texto para um comune oficial (ISTAT) e cria uma casa com o @ dela nessa cidade.
- A primeira pessoa de uma cidade vira "Fundador/a" para sempre.
- Pontos fazem a casa crescer (15 níveis) e definem cargos semanais.
- Ninguém pode comprar pontos nem cargos.

## 2. Pontos (valores do México)

| Ação | Pontos | Limite |
|---|---|---|
| Ter casa | +10 | uma vez |
| Comentar num post | +5 | por post |
| Comentários extras | +1 | até 10 |
| Amigo marcado | +3 | até 10 |
| Amigo que entrou (recrutou) | +25 | — |
| Voto recebido | +5 | 1 por pessoa por post |
| Story marcando o perfil | +20 | 1 por dia, dobra em dias especiais |

- Story também deixa a casa "em chamas" 🔥 por 24 h.
- "Sequências" (rachas) de dias seguidos são rastreadas.
- Regra recente: comentar várias vezes não soma mais (protege o alcance).

## 3. Níveis da casa (pontos acumulados, nunca diminuem)

| Mín. | México | Itália (proposta) |
|---|---|---|
| 0 | Casita | Casetta |
| 20 | Casa | Casa |
| 30 | Casa con jardín | Casa con giardino |
| 45 | Casa de dos pisos | Casa a due piani |
| 70 | Casa con cochera | Casa con garage |
| 100 | Casona | Casale |
| 140 | Casa con alberca | Casa con piscina |
| 190 | Residencia | Residenza |
| 250 | Villa | Villa |
| 330 | Mansión | Villa di lusso |
| 600 | Torre | Torre |
| 900 | Rascacielos | Grattacielo |
| 1300 | Hacienda | Masseria / Tenuta |
| 1900 | Palacio | Palazzo |
| 2800 | La cima del mapa | La vetta della mappa (con corona) |

## 4. Cidade (marcos por número de casas)

- Toda cidade nasce com praça e bandeira "Fundador".
- Igreja com 30 casas.
- Um prédio a cada 100 casas.
- Hospital com 1.000 casas.
- Estádio com 5.000 casas.
- Lojas: até 3 lotes comerciais por cidade, perto da praça.

Itália: piazza com fontana, chiesa com campanile, ospedale, stadio.

## 5. Cargos (mandato semanal: domingo 21h a domingo 21h)

| México | Vagas | Itália (proposta) |
|---|---|---|
| Presidente/a de México | 1 | Presidente del Consiglio |
| Senador/a | 3 por estado | Senatore/Senatrice, 3 por região |
| Gobernador/a | 1 por estado | Presidente della Regione |
| Diputado/a | 300, proporcional por estado (mín. 2) | Deputato/a, 400 proporcional por região (mín. 2) |
| Presidente/a municipal (CDMX: Alcalde) | 1 por município | Sindaco/a |
| Regidor/a | 10 por município | Consigliere/a comunale |

- Presidente e prefeitos são eleitos domingo 21h e governam a semana toda.
- Os demais cargos mudam ao vivo, com os pontos da semana.
- Desempate: vence a casa mais antiga.
- Um cargo por pessoa, de cima pra baixo.
- Aviso fixo: "Gioco apartitico: le cariche sono di gioco."
- Fuso: Europe/Rome.

## 6. Telas do site

**Topo**
- Marca + "Trova la tua casa".
- Busca por @, cidade ou região.
- Botão "?" (Come funziona).

**Chips de evento sob a busca**
- 🔥 case in fiamme ora.
- Evento sazonal (México: Día de Muertos/ofrendas; Itália: Natale/presepe).
- Derby da semana.
- Meta.

**Mapa 3D (Three.js)**
- País com relevo sombreado e divisas brancas.
- Pontos amarelos por cidade.
- Rótulos de cidade com nº de casas.
- Chip amarelo 🏛 com o governador de cada região.
- Chip vermelho ★ com o presidente.

**Zoom na cidade**
- Ruas, quadras, casas low-poly com o nível de cada jogador.
- Rótulos com @.
- Fogo nas casas em chamas.

**Controles:** +, −, ver país, ir pra minha casa.

**Painel da casa**
- Nível e escada de níveis com ícones.
- Barra colorida "de onde vêm teus pontos".
- Cargo.
- Botão "Carica la tua casa nella storia": gera a imagem PNG pronta.

**Painel da cidade**
- Fundador e data.
- Governo (sindaco e consiglieri).
- Ranking da cidade.
- Próximo edifício.
- Lote livre.
- "Atto di fondazione" (imagem compartilhável).

**Painel da região:** governador, senadores, deputados, posição na guerra de regiões.

**Abas inferiores**
- Mappa.
- Palazzo (Palacio): contagem regressiva do mandato, presidente, próxima eleição (quem lidera), guerra de regiões e governadores.
- Classifica (Ranking).
- Negozi.
- Tabellone (Marcador): cidades com mais casas, compartilhável.
- Senza padrone (Sin dueño): cidades sem fundador, cidades grandes vazias.

**Outros elementos**
- Botão "🎬 Crea video così": lista de espera.
- Pílula "+ il tuo negozio sulla mappa".
- Rodapé com data de atualização, versão do snapshot e privacidade.
- Tela de carregamento "Costruendo l'Italia…".

## 7. Negócios (monetização)

- Página em 3 passos: dados, revisão, pagamento.
- **Campos:** nome, Instagram, tipo, cidade (só cidades com casas), cor, logo, descrição de 200 caracteres, WhatsApp, e-mail.
- **Editor 3D da loja:** cores, toldo, letreiro, objeto gigante no teto, enfeites.
- **Pagamento:** Hotmart no México. Na Itália, Hotmart (EUR) ou Stripe.
  - O lote fica reservado 60 minutos.
  - Há aprovação manual, com reembolso se recusado.
- Até 3 lojas por cidade.
- Cartão no mapa com botão de WhatsApp.
- Tracking de cliques.

## 8. Pipeline de dados (backend)

1. Coleta de comentários dos posts (Instagram Graph API).
2. Coleta de menções em stories (webhook do Instagram Messaging).
3. Resolvedor de texto livre para comune ISTAT.
   - Fontes: lista oficial ISTAT (cerca de 7.900 comuni), siglas de província (NA, MI…), apelidos e frazioni.
   - Usa IA nos casos ambíguos.
   - No México, cerca de 30% dos comentários são rejeitados.
4. Moderação: palavrões e lista de bloqueio.
5. Motor de regras: pontos, níveis, cargos, chamas, sequências, eventos (cidade fundada, disputa).
6. Gera `snapshot.json` e publica.
   - O site checa `versao.txt` e recarrega sozinho.

## 9. Modo gravação de vídeo

O site deles aceita parâmetros de URL para gravar reels: hora, ângulo da câmera, formas, fila de cidades.
Replicar: câmera roteirizada e captura em 1080×1920.

## 10. Itália: dados geográficos

- **Limites:** ISTAT confini amministrativi (regioni, province, comuni), generalizados.
- **Relevo:** Copernicus DEM / EU-DEM, ou SRTM, convertido em heightmap.
- **População:** ISTAT.
- **Sazonais:** Natale (dezembro), Carnevale (fevereiro), Ferragosto (agosto).
- **Derby da semana:** rivalidades reais (Roma × Milano, Napoli × Torino…).

## 11. Jurídico (GDPR)

- Política de privacidade e termos em italiano.
- Base legal: interesse legítimo e consentimento ao comentar.
- Canal de remoção.
- Cuidado com menores de 14 anos (idade de consentimento digital na Itália).
- Pagamentos: recibo pela plataforma.
