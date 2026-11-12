---
name: "docs-planejamento-port-evolution-triviatende-md"
description: "Análise de porte do Evolution/TriviAtende para a Sinérgica — mapa citado pelas specs E02-S35..S41"
alwaysApply: false
---

# Port Evolution + visão de conversa — TriviAtende → Sinérgica SO

> **Status:** análise aprovada para virar specs. Não é ADR e não é spec — é o mapa que as specs citam.
> **Repositório de referência (somente leitura):** `/Users/lucasazevedo/orca/workspaces/Atendimento/rosefish`
> **Decisões desta rodada (Lucas, 2026-11-12):** porte **híbrido** (UI nova do TriviAtende sobre os dados
> existentes da Sinérgica) · só **WhatsApp/Evolution** (Instagram fica fora) · entrega com spec+plan+tasks.
> **Épico:** E02 — Atendimento · Zé.

---

## 0. O que muda a premissa do pedido

A Sinérgica **já tem** Evolution e inbox em produção: `atendimento.conversas`/`atendimento.mensagens`,
`atendimento.canais_externos` com `tipo='evolution'`, Edge Functions `atendimento-evolution` (administra
instância) e `pcm-whatsapp-webhook` (recebe), e UI `EvolutionTab` + `ConversaLista`/`ConversaChat`/
`MensagemBubble`/`RichComposer`.

Portanto isto **não é greenfield**. É fechamento de lacuna sobre uma base viva, com migration aditiva.
As lacunas reais, em ordem de risco, são:

| # | Lacuna | Hoje na Sinérgica | Consequência |
|---|---|---|---|
| 1 | Segredo do webhook é **global** (`EVOLUTION_WEBHOOK_TOKEN` em env), não por canal | `pcm-whatsapp-webhook` valida um token único para todas as instâncias | Quem conhece o token de um número escreve PII em qualquer conversa de qualquer número |
| 2 | **Nenhum canal na URL** do webhook | rota fixa `/functions/v1/pcm-whatsapp-webhook`; o canal vem do corpo (`payload.instance`) | O corpo é do terceiro: evento forjado escolhe a instância. Falha aberta |
| 3 | Idempotência **global** por `wa_message_id` | `unique` em `mensagens.wa_message_id` | Dois canais com o mesmo id remoto se anulam; não há escopo `(canal, evento, id)` |
| 4 | **Mídia recebida é descartada** | `extractEvolutionMessage` só extrai texto; imagem/vídeo/documento/figurinha viram `conteudo=""` | Cliente manda laudo/comprovante e some sem registro |
| 5 | **Citação e reação descartadas** | não existem colunas nem leitura | Resposta curta perde sentido; 👍 some |
| 6 | **URL do servidor Evolution sem validação** | `config.integracoes.config_publico.api_url` é usada direto | SSRF: a Edge Function chama endereço interno escolhido pela UI |
| 7 | **Sem matriz de compatibilidade** | nenhuma | Versão do servidor que não fala `webhookHeaders` passa no cadastro e falha em produção |
| 8 | **Token por instância não existe** | só a API key global, no Vault | Comprometer uma instância compromete todas |
| 9 | **Mensagem do aparelho não tira o agente** | `fn_registrar_mensagem_celular` grava `origem_envio='celular'` e **não** mexe em `modo`/`atribuido_a` | Humano responde pelo celular e o Zé responde de novo por cima |
| 10 | **Sem foto do contato** | avatar só com iniciais | — (cosmético, P3) |
| 11 | Visão de conversa pobre | `ConversaChat` monolítico, sem timeline tipada, sem contexto 360, sem fila com escopo | — (produto) |

O que **já está certo** e não se toca: Vault para a API key global
(`config.fn_obter_segredo_integracao_interno`), RLS enable+force nas tabelas de atendimento,
`origem_envio` já distinguindo formulário/IA/celular, rate limit de webhook
(`fn_consumir_rate_limit_webhook`), e o padrão de proxy de arquivo autenticado com `service_role`
(`pcm-evidencia-material-segura`) — que é exatamente a forma do `atendimento-anexo` do TriviAtende.

---

## a) Fluxo de configuração do número WhatsApp

Sequência atômica do ADR-0034 (TriviAtende), traduzida para a Sinérgica. Cada passo roda **no servidor**;
o browser nunca vê chave, token nem QR persistido.

### a.1 Passos de UI

```
Configurações → Integrações → WhatsApp (Evolution)
  ├─ [sem servidor]      formulário: URL-base + API Key global      → "Validar e salvar"
  ├─ [incompatível]      mostra versão detectada + capacidades que faltam  (bloqueia)
  ├─ [compatível]        lista de números; "Conectar o primeiro número"
  ├─ [criando]           cria instância remota + instala webhook      (automático)
  ├─ [incompleta]        instância existe, webhook falhou            → "Retomar configuração"
  ├─ [aceite de risco]   texto do risco de banimento (ADR-0007)      → "Li e aceito"
  ├─ [qr]                QR em memória, com contador de expiração    → "Já escaneei"
  └─ [conectado]         número, saúde, "Reinstalar recebimento", "Reiniciar pareamento"
```

Vistas espelhadas de `ConfiguracaoEvolution.tsx` (`sem-servidor | validando | incompativel | compativel |
criando | incompleta | pronta`) e `PainelDeEvolution.tsx` (`configurar | aceite | qr | conectado`).

### a.2 Chamadas à Evolution API (server-side)

| Ação | Chamada | Regra dura |
|---|---|---|
| `salvar_servidor` | `GET {urlBase}/` (versão/metadados) | URL atestada antes: HTTPS, sem credencial embutida, sem query/fragmento, DNS resolvido e IP público; loopback/link-local/metadata/privado negados; redirect não pode mudar origem. Depois, matriz de compatibilidade |
| `criar_instancia` | `POST /instance/create` com nome **derivado do `canalId`**, nunca escolhido pelo client | Idempotente; a resposta crua é descartada; o token da instância vai ao Vault |
| `instalar_webhook` | `POST /webhook/set/{nome}` | URL gerada no servidor **com o canal no caminho**; segredo aleatório por canal em cabeçalho customizado; `base64: false`; só os eventos mínimos |
| `gerar_qr` | `GET /instance/connect/{nome}` | QR só em memória do processo, expira por tempo e por uso; nunca toca o banco |
| `consultar_estado` | `GET /instance/connectionState/{nome}` | Só confirma `conectado_verificado` quando o número bate com o esperado do canal |

Eventos habilitados (ADR-0034): `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `MESSAGES_UPSERT`,
`MESSAGES_UPDATE`, `SEND_MESSAGE`. Nada além disso.

Capacidades obrigatórias da matriz: `instanceCreate`, `qr`, `connectionState`, `webhookHeaders`,
`webhookEvents`, `sendText`, `deliveryStatus`. **Versão fora da matriz falha fechada**, mesmo que os
endpoints pareçam existir.

### a.3 Persistência e estados do canal

```
sem_credencial → configurado → aguardando_pareamento → conectado_verificado
                      ↓ (webhook falhou)                      ↓ (sessão cai)
              configuracao_incompleta                    desconectado
```

- Falha entre "criar instância" e "instalar webhook" preserva a referência da instância e deixa
  `configuracao_incompleta`, **retomável** — nunca `conectado`.
- `salvarCredencial` **nunca** marca conectado: volta a `configurado`, pendente de verificação real.
- Saúde (`desconhecida | saudavel | degradada`) é alimentada pelo uso real — envio e webhook —, não por
  uma verificação isolada. Queda de sessão é rotina, não incidente: desconecta e registra o erro no
  mesmo passo.
- Desconectado **com** credencial anterior = "reescanear QR"; sem credencial = "configurar do zero".

### a.4 Degradação e recuperação

- `429` respeita `Retry-After`, com uma repetição limitada; depois o canal fica degradado e a conversa
  vai para humano.
- Falha de **autenticação** desconecta o canal automaticamente; outras falhas só degradam a saúde.
- "Reinstalar recebimento" troca só o webhook e preserva o pareamento.
- Excluir instância remota exige confirmação específica e checagem de conversas abertas; **desativar
  localmente é o rollback padrão**. Exclusão física de canal com histórico é proibida.

---

## b) Modelo de dados mínimo

Vocabulário: a Sinérgica usa `conversas`/`mensagens`/`canais_externos` (plural, snake_case, schema
`atendimento`). O porte **mantém o vocabulário da Sinérgica** e não importa o do TriviAtende
(`canal`/`conversa`/`mensagem`). Tudo abaixo é **aditivo**.

### b.1 Canal (estende `atendimento.canais_externos`)

```sql
alter table atendimento.canais_externos
  add column if not exists provedor         text,     -- 'evolution-api' | 'meta-whatsapp' | 'desconhecido'
  add column if not exists estado_conexao   text,     -- sem_credencial|configurado|aguardando_pareamento|conectado_verificado|configuracao_incompleta|desconectado
  add column if not exists saude            text,     -- desconhecida|saudavel|degradada
  add column if not exists ultimo_sucesso_em timestamptz,
  add column if not exists ultimo_erro_em    timestamptz;
```

Backfill sem adivinhação: linha legada sem prova do provedor recebe `'desconhecido'`, nunca um palpite.
Unicidade passa a `(tipo, identificador_externo, provedor)`.

### b.2 Servidor e instância Evolution (tabelas novas)

```sql
atendimento.evolution_servidor (
  id, url_base, versao_detectada,
  estado            check in ('pendente','compativel','incompativel'),
  motivo_incompatibilidade,
  credencial_ref,                 -- referência opaca ao Vault; NUNCA o valor
  indicio          check length<=4,-- 4 últimos caracteres, só para reconhecer geração
  geracao          check > 0,
  autor_id, criado_em, atualizado_em )

atendimento.evolution_instancia (
  canal_id  pk → canais_externos(id) on delete cascade,
  nome_remoto         unique,     -- derivado do canal_id, nunca do client
  token_ref,                      -- referência opaca ao Vault
  webhook_secret_ref,             -- referência opaca ao Vault
  estado   check in ('criando','configuracao_incompleta','aguardando_pareamento',
                     'conectado_verificado','desconectado'),
  autor_id, criado_em, atualizado_em )
```

RLS: `enable` + `force`; `revoke all` de `public, anon, authenticated`; política de escrita/leitura só
para **superadmin** (equivalente ao `admin` do TriviAtende), via a mesma forma de `auth.jwt()` já usada
nas policies de `atendimento`. Teste pgTAP com caso permitido (superadmin) e negado (colaborador com
`atendimento=escrita`).

### b.3 Inbox idempotente (tabela nova)

```sql
atendimento.evolution_inbox (
  canal_id          → canais_externos(id) on delete cascade,
  event_type        text,
  remote_message_id text,
  recebido_em       timestamptz default now(),
  primary key (canal_id, event_type, remote_message_id) )
```

RLS enable+force, `revoke all` de `public, anon, authenticated` — só `service_role` toca.
Chave de idempotência passa a ser **`(canal, evento, id remoto)`**, substituindo o `unique` global de
`mensagens.wa_message_id` como oráculo (a coluna continua, por compatibilidade).

### b.4 Mensagem (colunas novas, todas anuláveis)

```sql
alter table atendimento.mensagens
  add column if not exists legenda            text,
  add column if not exists conteudo_recebido  text,  -- imagem|video|documento|figurinha|localizacao|contato|enquete|outro
  add column if not exists anexo_estado       text,  -- guardado|acima_do_limite|tipo_nao_aceito|indisponivel
  add column if not exists anexo_bucket       text,
  add column if not exists anexo_path         text,
  add column if not exists anexo_nome         text,
  add column if not exists anexo_mime         text,
  add column if not exists anexo_tamanho_bytes bigint,
  add column if not exists derivada_de        uuid references atendimento.mensagens(id) on delete cascade,
  add column if not exists citada_mensagem_id uuid references atendimento.mensagens(id) on delete set null,
  add column if not exists citada_remote_id   text,
  add column if not exists citada_trecho      text,
  add column if not exists citada_autor       text;  -- cliente|ze|humano|desconhecido
```

CHECKs que importam (copiados em espírito do TriviAtende, traduzidos para `direcao`/`remetente_tipo`):

- `legenda`, `conteudo_recebido`, `anexo_*` e `citada_*` só valem para **mensagem de entrada do cliente**
  (`direcao='entrada' and remetente_tipo='cliente'`). A equipe grava mensagem direto pela tabela e
  **não pode apontar bucket nem caminho de anexo alheio**.
- `anexo_estado='guardado'` exige `tipo_conteudo in ('midia','audio')`; os estados de falha exigem
  `tipo_conteudo='texto'` com `conteudo_recebido` preenchido — o aviso vira texto, a mensagem nunca some.
- `anexo_bucket in ('atendimento-audios','atendimento-midias')`.
- `citada_autor in ('cliente','ze','humano','desconhecido')`, `citada_trecho` até 500 caracteres.
- índice único parcial em `derivada_de` (uma derivada por mensagem).

`tipo_conteudo` da Sinérgica já aceita `midia` e `audio`; não precisa de valor novo. `conteudo_recebido`
é que diz **o que era** (imagem, vídeo, documento, figurinha, aviso).

### b.5 Reação (tabela nova)

```sql
atendimento.reacoes_mensagem (
  mensagem_id  pk → mensagens(id) on delete cascade,
  conversa_id     → conversas(id) on delete cascade,
  emoji        text check length between 1 and 32,
  remote_id    text,
  atualizada_em timestamptz default clock_timestamp() )
```

Uma reação por mensagem, só do cliente, escrita **só pela RPC** (`revoke all` inclusive de
`service_role` para INSERT direto; `grant select` para `authenticated` sob a mesma policy de leitura de
conversa).

### b.6 Mídia e foto — Storage

| Bucket | Público | Limite | Mimes |
|---|---|---|---|
| `atendimento-midias` | **não** | 25 MB | imagens (jpeg/png/webp/gif/heic/heif), vídeos (mp4/3gp/mov), documentos (pdf, txt, csv, Office, LibreOffice) |
| `atendimento-audios` | **não** | 25 MB | ogg/opus/mpeg/mp4/wav/webm |
| `atendimento-fotos-contato` | **não** | 1 MB | jpeg/png/webp |

Sem política em `storage.objects`: só `service_role` lê e grava. O browser **nunca** recebe URL do
Storage nem do WhatsApp — recebe a rota do proxy autenticado (seção c.4).

### b.7 Foto do contato (tabela nova)

```sql
atendimento.foto_de_contato (
  conversa_id  pk → conversas(id) on delete cascade,   -- a Sinérgica não tem lead.contato; a foto mora na conversa
  estado   check in ('guardada','sem_foto','falhou'),
  mime     check in ('image/jpeg','image/png','image/webp'),
  hash     check ~ '^[0-9a-f]{64}$',
  consultada_em timestamptz default clock_timestamp(),
  atualizada_em timestamptz,
  check ((estado='guardada') = (mime is not null and hash is not null)) )
```

Mais `atendimento.conversas.foto_em timestamptz` como cópia de leitura, para a lista não pedir imagem
que não existe. Reserva atômica da consulta: no máximo **uma a cada 7 dias** por conversa.

> **Diferença estrutural assumida:** no TriviAtende a foto pertence ao `lead.contato` (identidade de
> WhatsApp por canal). A Sinérgica não tem essa entidade — `conversas` já é único por
> `(instance_id, remote_jid)`, que é exatamente "contato naquele canal". Ancorar na conversa é
> equivalente e evita criar uma entidade nova só por isso.

---

## c) Contrato do webhook

### c.1 Rota e autenticação

```
POST /functions/v1/atendimento-evolution-webhook/{canalId}
Header: x-sinergica-evolution-webhook: <segredo aleatório por canal>
```

Ordem obrigatória, sem exceção:

1. Método `POST`, senão `405`.
2. `canalId` extraído **do caminho**; ausente → `404 canal_nao_identificado`.
3. Busca o segredo **daquele canal** no Vault e compara em **tempo constante**. Divergência → `401 recusado`.
   **Isto acontece antes de ler o corpo** — nenhuma PII é parseada sem segredo válido.
4. Lê o corpo com teto de **256 KB** (`413` acima disso) e `content-type` JSON (`415`).
5. Reserva idempotência `(canalId, event_type, remote_message_id)`; duplicata responde `200 {duplicado}`.
6. Só então classifica e persiste.

Segredo em query string é **proibido**. O caminho carrega identificador público do canal, nunca segredo.
Evento de canal desconhecido **não cria canal** e **não cai num canal padrão**.

### c.2 Classificação (parser total, nunca lança)

Ignora sempre: evento ≠ `MESSAGES_UPSERT` (os de status só confirmam recebimento), `@g.us` (grupo),
`@broadcast`, `protocolMessage`, payload sem `key`/`message`/`remoteJid`/`id`.

Desembrulha até 3 níveis: `ephemeralMessage`, `documentWithCaptionMessage`, `viewOnceMessage`,
`viewOnceMessageV2`, `viewOnceMessageV2Extension`.

| Resultado | Campo do payload | O que grava |
|---|---|---|
| `texto` | `conversation` ou `extendedTextMessage.text` | mensagem de texto (como hoje) |
| `audio` | `audioMessage` | áudio guardado + transcrição **na mesma mensagem** (nunca duas) |
| `midia` | `imageMessage` / `videoMessage` / `documentMessage` / `stickerMessage` | mensagem com anexo + `legenda` (figurinha nunca tem legenda) |
| `aviso` | `locationMessage`/`liveLocationMessage` → localização · `contactMessage`/`contactsArrayMessage` → contato · `pollCreationMessage*` → enquete · `eventMessage`/`productMessage` → outro | mensagem de texto `[localização]` etc., sem o conteúdo |
| `reacao` | `reactionMessage` | linha em `reacoes_mensagem`; **não** cria mensagem, não muda a prévia da fila, **não aciona o Zé** |
| `aparelho` | `key.fromMe === true` | ver seção c.5 |
| `ignorar` | qualquer outro | `200`, sem efeito |

**Nenhum tipo desconhecido cai em texto por default.** Tipo não reconhecido vira `ignorar` ou aviso, nunca
uma fala inventada do cliente.

**Citação** (`contextInfo.stanzaId`): a Evolution 2 manda o `contextInfo` **fora** da mensagem
(`data.contextInfo`); o formato do WhatsApp o deixa **dentro** de cada tipo. Procurar nos dois. O trecho
citado vem de `quotedMessage` e é cortado em 500 caracteres; mídia citada vira `[imagem] legenda`,
`[documento] nome.pdf`, `[áudio]`, `[figurinha]`. Só o primeiro nível.

### c.3 Mídia: limites e aceitação

| Conteúdo | Limite | Mimes aceitos |
|---|---|---|
| imagem / figurinha | 10 MB | `image/jpeg`, `png`, `webp`, `gif`, `heic`, `heif` |
| vídeo | 16 MB | `video/mp4`, `3gpp`, `quicktime` |
| documento | 25 MB | `application/pdf`, `text/plain`, `text/csv`, Office (doc/xls/ppt + OOXML), LibreOffice (ODF) |

Recusados sempre, como `tipo_nao_aceito`: executáveis e scripts
(`exe msi bat cmd com scr ps1 vbs js mjs jar sh bash apk app dmg pkg deb rpm`), compactados
(`zip rar 7z tar gz bz2 iso`), e `html htm svg php py rb pl` — por extensão **e** por mime.

Ordem de conferência em `ingerirMidia`:

1. Extensão perigosa **ou** mime declarado fora da lista → `tipo_nao_aceito` (sem baixar nada).
2. `fileLength` declarado acima do limite → `acima_do_limite` (sem baixar nada).
3. Baixa da Evolution: `POST /chat/getBase64FromMediaMessage/{nome}` com `apikey` da instância,
   `redirect: 'error'`, timeout 20 s, teto de base64 calculado a partir do limite.
4. Reconfere **o arquivo real**: tamanho 0 → `indisponivel`; acima do limite → `acima_do_limite`;
   mime real fora da lista → `tipo_nao_aceito`.
5. Só então salva no bucket e grava `anexo_estado='guardado'`.

Qualquer estado de falha vira **mensagem de texto** `[imagem acima do limite] legenda: …` — a mensagem
nunca some. O nome é **saneado** (sem diretório, sem caracteres de controle, ≤120 chars, com extensão) e
o segmento do caminho no Storage é ASCII puro. A mídia **nunca é aberta, descomprimida nem
pré-processada** no servidor.

O que o Zé lê no lugar da mídia é uma descrição fixa: `[imagem] legenda: paguei a avaliação`,
`[documento: laudo.pdf] legenda: …`, `[figurinha]`. **O conteúdo do arquivo nunca entra no prompt.**
Mídia sem legenda (exceto figurinha) passa a conversa para a equipe com o motivo
"cliente enviou mídia sem texto", sem resposta do agente.

### c.4 Leitura do anexo pelo app

Rota autenticada nova `atendimento-anexo`, no molde já existente de `pcm-evidencia-material-segura`:
sessão obrigatória → rate limit → valida o formato do caminho → confere **pela RPC** que o usuário pode
ler aquela conversa → baixa do bucket privado com `service_role` → devolve bytes com
`Content-Type` confinado à lista, `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment`
para documento e `Cache-Control: private, no-store`.

Quem não pode ler a conversa recebe a **mesma resposta de "não encontrado"** de um anexo inexistente —
nem com o link de quem tem acesso.

### c.5 Mensagem do aparelho (ADR-0049)

`key.fromMe === true` em `MESSAGES_UPSERT` significa: alguém respondeu pelo celular, pelo WhatsApp Web,
por outro aparelho pareado, ou uma automação no mesmo número. Tudo conta como "aparelho".

- Grava em `atendimento.mensagens` com `direcao='saida'`, `remetente_tipo='humano'`,
  `origem_envio='celular'` — **já é o que a Sinérgica faz**. Não se cria autor novo.
- **Novo:** a conversa que estava com o Zé passa para humano — `modo='pausado'` e
  `atribuido_a` = pessoa do aparelho configurada no canal —, cancelando resposta e follow-up pendentes.
  **Sem pessoa configurada ("Ninguém"), nada muda: é a chave de desligar.**
- Só mensagem com `origem_envio` de sistema entra na fila de envio. A resposta do celular **nunca é
  reenviada** ao contato.
- **Eco** da própria mensagem: reconhecido pelo id gravado no envio; sem id ainda, pelo mesmo texto
  normalizado de uma mensagem do sistema em envio nos **últimos 20 minutos**.
- Mensagens automáticas do WhatsApp Business: lista de textos configurada **por canal**; não mudam a
  conversa.
- Mensagem com mais de **15 minutos** de atraso entra só no histórico, sem tirar o agente.
- Mídia do aparelho entra como **marcador de texto** (`[Imagem enviada pelo aparelho] legenda`), sem
  download e sem transcrição — transcrever gravaria autor `cliente` e acordaria o Zé.

Configuração por canal: `atendimento.canal_aparelho (canal_id pk, responsavel_id, textos_automaticos
jsonb, versao, atualizado_por, atualizado_em)`, com até 10 textos de até 1.000 caracteres, sem repetir.

### c.6 Foto do contato

Disparada **depois** que a mensagem já entrou, em segundo plano; falha nunca afeta a mensagem.
Reserva atômica de 7 dias por conversa. Aceita só arquivo vindo de endereço do WhatsApp, ≤1 MB, que
**seja de fato** JPEG/PNG/WebP (conferido pelo conteúdo, não pelo tipo declarado). Nova consulta sem
foto **apaga** a guardada e volta às iniciais. Endereço do WhatsApp, foto e número **nunca** em log.
Mensagem do aparelho **não** dispara consulta.

---

## d) Inventário de componentes da visão de chat

Componentes do TriviAtende (`apps/web/src/modules/atendimento/interfaces/`) e o que cada um faz:

| Componente | O que faz | Equivalente hoje na Sinérgica |
|---|---|---|
| `WorkspaceDeAtendimento.tsx` | Casca de 3 colunas (fila · conversa · contexto), orquestra revisão/refresh e injeta "demandas" do outro módulo sem import cruzado | — (hoje a página monta tudo inline) |
| `FilaDeConversas.tsx` | Lista com escopo (`ativas`/`encerradas`/`todas`), filtros, contador de "aguardando humano", prévia, não lidas, tags, foto | `ConversaLista.tsx` (4 KB, sem escopo nem contador) |
| `PainelDaConversa.tsx` | Cabeçalho + timeline + compositor + ações; resolve `podeResponder` vindo **do servidor**, não por ID no browser | `ConversaChat.tsx` (10 KB, faz tudo junto) |
| `TimelineDaConversa.tsx` | Renderiza **conteúdo tipado**: texto, imagem (amplia ao clicar), vídeo com player, documento com nome/tipo/tamanho, figurinha, áudio com transcrição, bloco "em resposta a" clicável, reação na bolha, aviso; rótulo "Pelo celular" / "Mensagem automática do WhatsApp" | `MensagemBubble.tsx` (4 KB, texto + áudio; sem citação, reação, documento, vídeo, aviso) |
| `CompositorDeResposta.tsx` | Caixa de resposta com anexo, emoji, respostas rápidas, limite de envio, rascunho preservado | `RichComposer.tsx` + `EmojiPicker.tsx` (já cobre boa parte) |
| `PainelDeContextoDoCliente.tsx` | Contexto 360: dossiê da pessoa, campos por papel, oportunidade, histórico | `ConversaPerfil.tsx` (4 KB, bem mais magro) |
| `AcaoDeHandoff.tsx` | Devolver ao agente / transferir, com destinos vindos do servidor e aviso de impacto | `onAssumir`/`onDevolver` como botões soltos no `ConversaChat` |
| `AcaoDeEncerrar.tsx` | Encerrar com confirmação e tratamento de conflito de versão | — |
| `RespostasPeloAparelho.tsx` | Configura a pessoa do aparelho e os textos automáticos do canal (ADR-0049) | — |
| `PainelDeCanais.tsx` | Administra canais: vincular/desvincular agente, padrão, desativar, configuração do aparelho | `EvolutionTab.tsx` + `CanalExternoTab.tsx` (parcial) |
| `SinalComercialDaConversa.tsx` | Sinal comercial qualificado pelo agente | — (não se aplica; Sinérgica tem `historico-chamado`) |
| `ResumoDaConversa.tsx` | Resumo gerado + "desatualizado" | — |
| `estado-do-workspace.tsx` | Contexto React: rascunho por conversa, anexos pendentes, operações idempotentes (`operacaoId` reusado em retry) | — (hoje `useState` local) |
| `contador-da-fila.ts` | Badge: conta **aguardando humano**, não o total | — |
| `preferencia-do-contexto.ts` | Lembra a coluna de contexto aberta/fechada em `localStorage`, com try/catch | — |
| `rotas.tsx` | `/atendimento` e `/atendimento/conversas/$conversaId` | rotas próprias da Sinérgica |
| `application/portas.ts` | **O contrato**: `RepositorioDeConversa` (listar/assumir), `+Leitura` (abrir), `+Resposta`, `+Handoff`, `+Transferência`, `+Resumo`, `+SinalComercial`. Quem age **nunca** entra por parâmetro — a identidade vem de `auth.uid()` dentro do adapter | `atendimento-gateway.ts` + `supabase-atendimento-adapter.ts` (forma parecida, contrato mais raso) |

Invariantes da UI que vêm junto e não são negociáveis no porte:

- **Quem age não entra por parâmetro.** Se viesse do browser, um atendente autenticado poderia atribuir
  a conversa a outra pessoa — e a atribuição é o único registro de qual humano leu o histórico de
  WhatsApp de um cliente.
- Domínio **nunca** recebe `File`, `Blob` ou URL do browser — só metadados portáveis (`ArquivoDaMensagem`).
- `podeResponder` é sinal calculado pela policy no servidor.
- `operacaoId` reusado em retry, para o banco não duplicar mensagem.

---

## e) Mapa de diferenças TriviAtende → Sinérgica

### e.1 Copia direto (lógica pura, sem dependência de schema)

| Arquivo de origem | Destino na Sinérgica | Observação |
|---|---|---|
| `supabase/functions/evolution-webhook/midia.ts` | `supabase/functions/_shared/evolution-midia.ts` | Puro: listas de mime, limites, `sanearNome`, `nomeParaChave`, `midiaDaMensagem`, `avisoDaMensagem`, `citacaoDaMensagem`, `reacaoDaMensagem`, `textoParaAgente`. **Adaptar só os rótulos em PT** |
| `evolution-webhook/mensagem-do-aparelho.ts` | `_shared/evolution-aparelho.ts` | Puro. `telefoneDoContatoEvolution` precisa de equivalente (a Sinérgica usa `remote_jid` cru) |
| `modules/atendimento/domain/evolution.ts` (matriz de compatibilidade) | `features/atendimento/domain/evolution-compatibilidade.ts` | Puro. A cópia espelhada dentro da Edge Function é **obrigatória** — Deno não importa do bundle Vite |
| `evolution-configurar/index.ts`: `validarUrlDoServidor`, `resolverEnderecosPublicos`, `ipv4PrivadoOuLoopback`, `ipv6PrivadoOuLoopback`, `nomeRemotoDaInstancia` | `_shared/evolution-url.ts` | Anti-SSRF puro |
| `evolution-pareamento/index.ts`: `criarArmazenamentoDeQrEmMemoria` | função `atendimento-evolution-pareamento` | Puro |
| `application/verificar-canal.ts`, `registrar-saude.ts`, `processar-entrega-evolution.ts` | `features/atendimento/application/` | Puros; só trocam os nomes dos estados |
| `interfaces/preferencia-do-contexto.ts`, `contador-da-fila.ts` | `features/atendimento/interfaces/` | Puros |
| `surfaces/integracoes/ConfiguracaoEvolution.tsx` (máquina de vistas) | `features/atendimento/components/ConfiguracaoEvolution.tsx` | A **lógica** `vistaDoEstado` e os textos de erro copiam; o JSX/Tailwind é reescrito nos tokens da Sinérgica |

### e.2 Precisa adaptar

| Tema | TriviAtende | Sinérgica | Como adaptar |
|---|---|---|---|
| **Vocabulário** | `canal`/`conversa`/`mensagem` (singular), `lead`, `agente`, `atendente` | `canais_externos`/`conversas`/`mensagens`, `cliente`, `ze`, `humano` | Mantém o vocabulário **da Sinérgica**; entra no `docs/glossary.md` no mesmo PR |
| **Autorização** | `app.papel_atual() = 'admin'`, `core.pode_ler_conversa_atual()` | `auth.jwt() ->> 'user_role' = 'superadmin'` e `auth.jwt() -> 'user_modulos' ->> 'atendimento'` | Traduzir as policies; criar o helper `atendimento.fn_pode_ler_conversa(uuid)` como ponto único |
| **Cofre** | RPCs `core.cofre_gravar_segredo` / `cofre_ler_segredo` sobre `vault.secrets` | `config.fn_obter_segredo_integracao_interno(chave)` (leitura) | A Sinérgica **já tem leitura**; falta a **escrita por referência opaca** e o conceito de **geração**. Estender, não trocar |
| **Autor da mensagem** | `autor in ('lead','agente','atendente')` + `origem_envio` | `direcao` + `remetente_tipo` + `origem_envio` | Mapa: `lead`→`entrada/cliente` · `agente`→`saida/ze` · `atendente`→`saida/humano`; `origem_envio='aparelho'`→`'celular'` (já existe) |
| **Tirar o agente** | `conversa` passa a `com_atendente`, sobe `responsavel_versao` | `conversas.modo` (`auto`/`pausado`) + `atribuido_a` | `modo='pausado'` + `atribuido_a = responsavel do aparelho`. **Falta versão de responsável** — ou se adota uma coluna `responsavel_versao` para CAS, ou se aceita a corrida (decisão de ADR) |
| **Foto** | ancorada em `lead.contato` | não existe `contato` | Ancorar em `conversas` (único por `instance_id, remote_jid`) |
| **Transcrição de áudio** | OpenRouter/Whisper, transcrição **na mesma mensagem** | já existe transcrição, mas duplicando em mensagem separada | Trocar para `derivada_de` / mesma mensagem — é a US2 da spec 024 |
| **Idempotência** | `(canal, evento, remote_id)` em tabela própria | `unique(wa_message_id)` global | Adicionar `evolution_inbox` como oráculo; manter a coluna velha |
| **Rate limit** | circuito por canal | `fn_consumir_rate_limit_webhook` global por chave | Já serve: a chave vira `evolution:{canalId}` |
| **Proxy de anexo** | `atendimento-anexo/index.ts` | `pcm-evidencia-material-segura` tem a forma pronta | Clonar a forma, trocar bucket e a checagem de permissão |

### e.3 Não se aplica

- **Instagram Direct** (spec 039, `meta-instagram-*`): fora do escopo desta rodada por decisão.
- **WhatsApp Cloud API oficial** (ADR-0006, `meta-whatsapp-*`): a Sinérgica tem `canais_externos` com
  `tipo='meta_wa'`, mas a spec 024/025 é explicitamente só Evolution.
- **`SinalComercialDaConversa`, `ResumoDaConversa`, anúncios/Links rastreados** (`anuncio.ts`,
  `codigoDaMensagem`): são do produto comercial do TriviAtende. A Sinérgica tem
  `historico-chamado` e `scoring-clusters`, que cumprem outro papel.
- **Múltiplos agentes por canal (`CanalAgente`, ADR-0033)**: a Sinérgica tem
  `instancias_agente (instance_id → persona)`, que já é 1:1 por instância. Ampliar para N:N é escopo
  próprio, não entra aqui.
- **`lead.resolver_contato_whatsapp_servico`, módulo `lead`, funil, oportunidade**: a Sinérgica resolve
  o cliente por `config_ze.group_jid`. Não se importa a entidade `Lead`.
- **`core.auditoria_*` do TriviAtende**: a Sinérgica tem `audit.*` própria; registra lá.

### e.4 ADRs e débito

Precisam de ADR novo na Sinérgica **antes** de implementar (tier arquitetural: integração externa +
schema com dado em produção):

| ADR | Assunto | Base |
|---|---|---|
| `1686` | Evolution configurada pela UI: servidor atestado, matriz de compatibilidade, instância criada pelo produto, segredo por canal | ADR-0034 + 0007 |
| `1687` | Webhook por canal: canal no caminho, segredo próprio, idempotência `(canal, evento, id)` | ADR-0033 (roteamento de entrada) |
| `1688` | Mensagem do aparelho tira o Zé | ADR-0049 |

Débito a registrar em `docs/SECURITY_DEBT.md` já na primeira story:

- Exclusão de dados a pedido do titular não existe; quando existir, precisa apagar mídia e foto guardadas.
- `EVOLUTION_WEBHOOK_TOKEN` global continua válido durante a transição; a remoção dele é o fim do porte.

---

## f) Stories propostas (épico E02 — Atendimento · Zé)

Maior ID usado hoje: `E02-S34`. Próximos livres: **S35 em diante**.

| ID | Story | Tier | Depende de |
|---|---|---|---|
| `E02-S35` | Canal Evolution confiável: servidor atestado, matriz de compatibilidade, instância e token por canal no Vault, estados e saúde | arquitetural | — |
| `E02-S36` | Webhook por canal: canal no caminho, segredo próprio em tempo constante, idempotência `(canal, evento, id)`, classificação total | arquitetural | S35 |
| `E02-S37` | Mídia recebida: imagem, vídeo, documento, figurinha e aviso guardados e visíveis; proxy de anexo autenticado; transcrição uma vez só | arquitetural | S36 |
| `E02-S38` | Citação e reação na conversa | feature | S37 |
| `E02-S39` | Mensagem do aparelho tira o Zé | arquitetural | S36 |
| `E02-S40` | Foto do WhatsApp do contato no atendimento | feature | S36 |
| `E02-S41` | Visão de conversa nova: workspace, fila com escopo, timeline tipada, contexto 360, ações de handoff | feature | S37, S38 |

Ordem de valor: S35 → S36 → S37 → S39 → S38 → S41 → S40.
S39 pode ir em paralelo a S37 (toca outro caminho do mesmo webhook).

---

## Rastreabilidade

- Origem: `rosefish` — ADRs `0007`, `0033`, `0034`, `0037`, `0049`; specs `024-midia-recebida-evolution/`,
  `025-foto-do-contato/`; runbook `docs/runbooks/EVOLUTION-PILOTO.md`.
- Migrations de referência: `20260916090000`, `20260916100500`, `20260923110000`, `20260923120000`,
  `20260924133000`, `20261106126000`, `20261106128000`, `20261107130000`, `20261108130000`,
  `20261109140000`.
- Os `.test.ts` ao lado de cada arquivo do `rosefish` são a especificação executável dos casos de borda
  e dos formatos de payload da Evolution — leia-os ao implementar, não ao planejar.
