# Guia: ligar o jogo ao Instagram

Siga na ordem. Os nomes dos botões no painel da Meta mudam de vez em quando; se algum estiver diferente, procure o equivalente ou me mande um print.

## Parte A — agora (comentários)

### 1. Conta profissional
1. Crie o perfil @italiacasapercasa (ou o @ escolhido) no Instagram.
2. Vá em **Configurações → Tipo de conta e ferramentas → Mudar para conta profissional**.
3. Escolha **Criador de conteúdo** (ou Empresa) e a categoria **Videogame** ou **Site de entretenimento**.

### 2. Conta de desenvolvedor da Meta
1. Entre em **developers.facebook.com** com uma conta do Facebook sua.
2. Clique em **Começar** e confirme o cadastro de desenvolvedor (pede telefone ou cartão só para verificação).

### 3. Criar o app
1. **Meus apps → Criar app**.
2. Caso de uso: **Gerenciar mensagens e conteúdo no Instagram** (em inglês: *Manage messaging & content on Instagram*).
3. Nome do app: por exemplo `Italia Casa per Casa`. Tipo: **Empresa**.

### 4. Permissões e token
1. No menu da esquerda do app: **Casos de uso** → no card do Instagram, **Personalizar** → aba **Configuração da API com login do Instagram**.
   (O token **não** fica em "Funções do app".)
2. Em **Gerar tokens de acesso**, clique em **Adicionar conta** e entre com o Instagram do jogo. Depois clique em **Gerar token** ao lado da conta.
   - Não aparece a conta ou o botão? Confira se o Instagram é conta profissional e, se precisar, em **Funções do app → Funções → Adicionar pessoas → Testador do Instagram**, convide o @ do jogo e aceite em instagram.com → Configurações → **Apps e sites → Convites de testador**.
   - O token só aparece uma vez: se fechar sem copiar, gere de novo.
3. Aceite as permissões:
   - `instagram_business_basic`
   - `instagram_business_manage_comments`
   - `instagram_business_manage_messages` (para as stories, Parte B)
4. Copie o **token** que aparece. Ele vale 60 dias; o atualizador renova sozinho a cada 30.
5. Na mesma página, anote a **chave secreta do app do Instagram** (vamos usar na Parte B).

> Para a sua própria conta o **acesso padrão** basta: não precisa de revisão da Meta para ler os comentários.

### 5. Configurar no computador
1. Na pasta `C:\Users\disch\Italia3D\config`, copie `instagram.esempio.json` para `instagram.json`.
2. Abra `instagram.json` no Bloco de Notas e preencha:
   - `token`: o token do passo 4.
   - `inizio`: data e hora do primeiro post do jogo (ex.: `"2026-11-01T18:00:00+01:00"`). Posts antes disso são ignorados.
3. **Nunca** mande esse arquivo para ninguém nem publique: o token dá acesso ao perfil.

### 6. Primeiro teste
1. Publique um post de teste e comente você mesmo com outra conta: `Napoli, Campania`.
2. Dê dois cliques em **`aggiorna-mappa.bat`**.
3. Deve aparecer algo como `1 posts · 1 comentários novos` e `1 casas em 1 comuni`.
4. Abra o site (`avvia-sito.bat`) e procure o @ que comentou.

## Parte B — Fase 4 (stories e site no ar)

As menções em stories não têm endpoint: a Meta avisa por **webhook**, que precisa de um endereço público (o site hospedado). Faremos juntos na Fase 4:
1. Subir o site e a pasta `privato/` (com `config.php` preenchido a partir de `config.esempio.php`).
2. No painel do app: **Webhooks → URL de retorno** `https://SEU-DOMINIO/api/webhook.php`, **token de verificação** igual ao `VERIFY_TOKEN`, e assinar o campo **messages**.
3. Em `config/instagram.json`, preencher `webhook_storie` com `https://SEU-DOMINIO/api/storie.php?chiave=CHIAVE_DOWNLOAD`.
4. Para receber menções de **qualquer pessoa** (não só de quem tem função no app), o app precisa estar no modo **Ao vivo**. Isso pede URL da política de privacidade e instruções de exclusão de dados (já temos a página `privacy.html`) e, dependendo da permissão, uma revisão da Meta.

Enquanto o webhook não estiver no ar, dá para creditar stories manualmente:
`node strumenti/amministra.mjs storia @conta`

## Comandos de administração

Abra o PowerShell na pasta do projeto e use `.tools\node-v22.11.0-win-x64\node.exe strumenti\amministra.mjs <comando>`:

| Comando | Para quê |
|---|---|
| `stato` | resumo: última coleta, token, casas, pendentes |
| `prova "sono di bari"` | mostra qual cidade o sistema entende |
| `pendenti` | comentários sem cidade clara para você revisar |
| `correggi "Calliano" "Calliano (TN)"` | ensina o sistema: esse texto = essa cidade |
| `assegna @conta "Calliano (AT)"` | define a cidade de uma conta |
| `blocca @conta` / `sblocca @conta` | esconde/mostra uma casa (nome ofensivo, spam) |
| `storia @conta` | credita uma story manualmente |
| `doppi "2026-11-08 10:00" "2026-11-08 21:00" storia` | pontos em dobro nas stories (hora de Roma) |

Depois de qualquer comando, rode `aggiorna-mappa.bat --senza-instagram` para refazer o mapa sem baixar de novo.
