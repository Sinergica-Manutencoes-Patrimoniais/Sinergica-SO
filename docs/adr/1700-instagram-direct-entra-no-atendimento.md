---
name: "docs-adr-1700-instagram-direct-entra-no-atendimento-md"
description: "Documento Sinérgica SO: ADR-1700 — Instagram Direct entra no Atendimento pelo mesmo modelo de canal do Evolution; reverte a decisão de 12/11 que deixava o Instagram fora (E02-S16/E02-S17)"
alwaysApply: false
---

# ADR-1700 — Instagram Direct entra no Atendimento, pelo modelo de canal da E02-S35..S41 (E02-S16/E02-S17)

**Status:** aceita · **Data:** 2026-11-25 · **Stories:** E02-S16, E02-S17 · **Tier:** arquitetural
**Motivo do tier:** integração externa nova em caminho de recebimento de PII (webhook de terceiro),
com credencial em produção e schema sobre dado vivo. Reverte uma decisão de PO registrada.

**Esta ADR não edita nenhuma outra: ela substitui a decisão de 2026-11-12 registrada em
`docs/planejamento/port-evolution-triviatende.md`.** A convenção do projeto é nunca editar ADR nem
decisão antiga; esta é a que a sucede. A ADR-1687 (webhook por canal) continua valendo integralmente
— esta a estende para o provedor Meta em vez de abrir um caminho paralelo.

## Contexto

Em 12/11/2026 o Lucas fechou o escopo do porte do TriviAtende com a frase registrada em
`docs/planejamento/port-evolution-triviatende.md`: porte híbrido, **"só WhatsApp/Evolution (Instagram
fica fora)"**. A seção `e.3 Não se aplica` daquele documento diz, textualmente:
*"**Instagram Direct** (spec 039, `meta-instagram-*`): fora do escopo desta rodada por decisão."*

A rodada E02-S35..S41 foi executada sob essa decisão e deixou pronto o modelo de canal confiável:
canal no caminho do webhook, segredo próprio por canal no Vault comparado em tempo constante,
idempotência `(canal, evento, id remoto)` em `atendimento.evolution_inbox`, rate limit por canal,
estados e saúde em `atendimento.canais_externos`.

Em paralelo, a E02-S16 já tinha deixado no repositório um caminho Meta **anterior a esse modelo**:
`atendimento-meta-webhook` em rota fixa, **um único `META_APP_SECRET` global** em variável de
ambiente para todas as contas, `META_ACCESS_TOKEN` global para todo envio, e o `verify_token` do
webhook gravado **em claro** na coluna `atendimento.canais_externos.verify_token`, legível por
qualquer usuário com `atendimento` em leitura. É exatamente a classe de falha que a E02-S36 corrigiu
para o Evolution (segredo global + canal resolvido pelo corpo do evento).

Em 25/11/2026 o Lucas decidiu o contrário da decisão de 12/11: **o Instagram entra completo** —
Direct no Inbox junto com o WhatsApp, webhook da Meta e resposta pela Meta.

## Decisão

1. **Instagram Direct é um canal de primeira classe no Atendimento.** Conversa de Instagram aparece
   no mesmo Inbox das de WhatsApp, com o canal identificado, e é respondível pela Meta.
2. **Instagram usa o modelo de canal da ADR-1687, não um segundo caminho.** Concretamente:
   - webhook em `POST /functions/v1/atendimento-meta-webhook/{canalId}` — o canal vem **do caminho**,
     nunca do corpo; `entry[].id` divergente do `identificador_externo` do canal responde
     `409 canal_divergente` em vez de cair num canal padrão;
   - assinatura `X-Hub-Signature-256` conferida com o **app secret daquele canal**, lido do Vault por
     referência opaca (`config.fn_ler_segredo_referenciado`), comparada em **tempo constante** sobre
     os **bytes crus** do corpo, antes de qualquer `JSON.parse`;
   - `GET` de verificação (`hub.challenge`) confere o `hub.verify_token` **daquele canal**, também do
     Vault e também em tempo constante;
   - rate limit por canal (`fn_consumir_rate_limit_webhook`, chave `meta:{canalId}`), teto de corpo
     de 256 KB e `content-type` JSON obrigatório;
   - idempotência **`(canal_id, event_type, remote_message_id)`** reusando
     `atendimento.evolution_inbox` — a mesma tabela, porque a chave já é genérica. Criar uma segunda
     tabela de inbox só para a Meta seria duplicar sistema existente.
3. **Nenhuma credencial Meta em variável de ambiente global.** App secret, token de página/conta e
   verify token de cada canal vão para o Vault sob referência opaca, apontada por
   `atendimento.meta_canal`. `META_APP_SECRET` e `META_ACCESS_TOKEN` deixam de ser o caminho normal
   (ver "o que isto custa").
4. **`atendimento.canais_externos.verify_token` para de guardar segredo.** A coluna é esvaziada e
   passa a ter `check (verify_token is null)`: segredo não mora em tabela que `authenticated` lê.
5. **A automação de comentário de Instagram (E02-S17) fica como está.** O repositório de referência
   (`rosefish`) **não tem** contraparte: lá o Instagram é só Direct, e `subscribed_fields` pedido à
   Meta é `messages,message_reactions` — `comments`/`feed` nunca são assinados. Não há o que portar;
   o que existe aqui continua, agora atrás da mesma autenticação por canal.
6. **Regra do Direct, vinda da Meta e não negociável no produto:** texto puro, teto prático de 1000
   bytes UTF-8, e **janela de 24 h** desde a última mensagem do contato. Fora da janela a Meta recusa
   (`code 10`, `subcode 2534022`); a UI avisa antes de deixar enviar, em vez de registrar uma bolha
   que nunca chega.

## O que isto custa, dito na cara

- **Uma superfície de recebimento de PII a mais, de um terceiro que nos entrega conteúdo de pessoas
  que não são clientes.** Direct de Instagram traz mensagem de qualquer um que escreva para a conta.
  Esse dado entra em `atendimento.conversas`/`mensagens` com a mesma RLS do WhatsApp, e a exclusão de
  dado a pedido do titular **continua não existindo** (débito já registrado na E02-S35). O volume
  desse débito cresce com esta decisão.
- **Reconfiguração obrigatória de todo canal Meta já cadastrado.** Esvaziar `verify_token` e parar de
  usar `META_APP_SECRET` significa que um canal Meta configurado antes desta story **para de receber**
  até alguém reconectá-lo pela tela, colando token e segredo. Não dá para migrar automaticamente: o
  valor em claro que existe na coluna pode ser qualquer coisa e não há prova de qual app ele serve.
  Em 25/11/2026 não há canal Meta conectado em produção, o que torna o custo teórico — mas ele é real
  se alguém conectar um antes do merge.
- **Mídia de Instagram não é guardada.** Foto, vídeo, áudio, reel, story e compartilhamento entram
  como **aviso de texto** (`[imagem]`, `[story]`…), não como anexo. É o que o `rosefish` faz, e é
  deliberado: baixar mídia da Meta exige token de página em caminho de download, outro bucket e outra
  rodada de limites. Quem precisa ver o conteúdo abre o app do Instagram. Isso é uma diferença visível
  para o atendente em relação ao WhatsApp, que **guarda** mídia desde a E02-S37.
- **O Zé não responde Instagram.** `canalSuportaIa` continua `whatsapp`-only. Conversa de Direct chega
  como humana. Ligar o agente em Direct exigiria revisar prompt, janela de 24 h e limite de bytes —
  escopo próprio, não entra aqui.
- **Duas verdades sobre "o que é um canal".** `canais_externos.tipo` ('meta_wa', 'instagram',
  'messenger', 'evolution') e `canais_externos.provedor` ('evolution-api', 'meta-whatsapp',
  'meta-instagram', 'meta-messenger', 'desconhecido') coexistem. Não se unifica agora porque `tipo`
  tem consumidor em produção; a dívida fica dita.
- **`atendimento.evolution_inbox` passa a guardar evento que não é do Evolution.** O nome mente.
  Renomear tabela com dado em produção para ganhar um nome melhor não vale o risco; o comentário da
  tabela diz o que ela é de verdade.

## Alternativas consideradas

- **Manter o Instagram fora (decisão de 12/11).** Recusada pelo Lucas em 25/11: o Direct é canal de
  entrada real do cliente, e deixá-lo fora obriga o atendente a trabalhar em duas telas.
- **Reaproveitar `atendimento-meta-webhook` como está, só adicionando Instagram.** Recusada: é o
  caminho de token global que a ADR-1687 existe para eliminar. Quem conhecesse o `META_APP_SECRET` de
  uma conta escreveria PII na conversa de qualquer outra — o achado que originou a E02-S36.
- **Criar `atendimento-instagram-webhook` separado, espelhando o `rosefish`.** Recusada: seriam duas
  funções com a mesma ordem de verificação e o mesmo bug a corrigir em dois lugares. A Meta manda
  WhatsApp Cloud, Instagram e Messenger pelo mesmo formato de `entry`; o discriminador é
  `payload.object`, dentro de um único handler já autenticado por canal.
- **Tabela de inbox própria para a Meta.** Recusada: `evolution_inbox` já é `(canal, evento, id)`.
  Duplicar sistema existente é anti-padrão nomeado em `ANTI-PADROES.md`.
- **Guardar mídia do Direct desde já.** Adiada, não recusada — ver custo acima.

## Reversão

Desligar é por canal, não por código: `atendimento.canais_externos.ativo = false` no canal de
Instagram faz o webhook responder `404 canal_nao_identificado` e some do Inbox o caminho de envio.
A flag `VITE_SSO_INSTAGRAM_DIRECT_ENABLED` desliga a tela de conexão **anunciando que está desligada**.
Voltar atrás por completo é remover `atendimento.meta_canal` e os segredos do Vault; as conversas de
Instagram já recebidas permanecem, porque apagar histórico de atendimento é proibido.
