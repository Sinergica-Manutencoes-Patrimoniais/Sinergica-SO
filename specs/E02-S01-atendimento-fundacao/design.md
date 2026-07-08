---
name: design
description: Arquitetura — schema atendimento.conversas/mensagens e integração aditiva do Agente Zé.
alwaysApply: false
---

# Design — Fundação do Inbox de Atendimento

## Componentes

### 1. `atendimento.conversas` / `atendimento.mensagens` (tabelas novas)
Não reaproveita `wa_messages`/`wa_queue` — são mecânica de ingestão/dedupe do Zé com ciclo de vida
efêmero por rajada (`wa_queue` some do estado `pending` assim que processado); misturar aí o
conceito de "conversa com estado de atendimento humano" (aberta/pendente/encerrada, atribuição,
não-lidas) quebraria a responsabilidade única dessas tabelas e arriscaria regredir o Fluxo A já em
produção. `conversas`/`mensagens` são o aggregate voltado a humano: Zé e humano escrevem na mesma
tabela de mensagens, sem um "dono" — implementa literalmente o requisito "Zé é um agente dentro da
estrutura de atendimento".

```sql
create table atendimento.conversas (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid references pcm.clientes,          -- nullable: condomínio pode não estar configurado ainda
  canal                   text not null default 'whatsapp' check (canal in ('whatsapp')),
  instance_id             text not null,
  remote_jid              text not null,
  contato_nome            text,
  status                  text not null default 'aberta' check (status in ('aberta','pendente','encerrada')),
  modo                    text not null default 'auto' check (modo in ('auto','pausado')),
  atribuido_a             uuid references auth.users,
  nao_lidas               int not null default 0,
  ultima_mensagem_preview text,
  ultima_mensagem_em      timestamptz,
  ordem_servico_id        uuid references pcm.ordens_servico(id),
  tags                    text[] not null default '{}',
  created_at timestamptz not null default now(), created_by uuid references auth.users,
  updated_at timestamptz, updated_by uuid references auth.users,
  unique (instance_id, remote_jid)
);

create table atendimento.mensagens (
  id             uuid primary key default gen_random_uuid(),
  conversa_id    uuid not null references atendimento.conversas(id),
  direcao        text not null check (direcao in ('entrada','saida')),
  remetente_tipo text not null check (remetente_tipo in ('cliente','ze','humano')),
  remetente_id   uuid references auth.users,          -- só quando remetente_tipo='humano'
  conteudo       text,
  tipo_conteudo  text not null default 'texto' check (tipo_conteudo in ('texto','sistema')),
  wa_message_id  text unique,                          -- liga de volta a wa_messages.message_id, idempotência
  status_entrega text check (status_entrega in ('enviando','enviado','erro')),
  erro_detalhe   text,
  created_at     timestamptz not null default now()
);

create index idx_conversas_status_atividade on atendimento.conversas (status, ultima_mensagem_em desc);
create index idx_conversas_atribuido on atendimento.conversas (atribuido_a);
create index idx_mensagens_conversa_created on atendimento.mensagens (conversa_id, created_at);
```

**`modo` é a peça central**: override **por conversa**, distinto de `config_ze.modo` (por
condomínio). Sem essa distinção, um humano assumindo 1 conversa pausaria o Zé para *todas* as
conversas daquele condomínio.

RLS FORCE em ambas, policies no mesmo padrão já em produção para `wa_messages`/`config_ze`
(`auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'atendimento' in
(...)`), sem policy de `delete` para `authenticated` (mesmo padrão do resto do projeto). Migration
única `0039_E02-S01_atendimento_conversas_mensagens.sql`, molde de `0035_E01-S32_equipes.sql`.

### 2. `_shared/evolution.ts` (novo, compartilhado)
Extrai `responderEvolution()` de `pcm-ze-agent/index.ts` para um helper reusado também pela Edge
Function de envio humano (item 4) — elimina duplicação da chamada `POST
/message/sendText/{instanceId}` entre as duas funções.

### 3. `pcm-whatsapp-webhook/index.ts` — mudança aditiva
Depois do upsert em `wa_messages` (linha ~50-62), adiciona:
1. Upsert em `atendimento.conversas` por `(instance_id, remote_jid)` — no conflict, atualiza
   `ultima_mensagem_em`/`ultima_mensagem_preview`, incrementa `nao_lidas`; no insert, tenta
   resolver `client_id` via `select client_id from atendimento.config_ze where group_jid =
   remote_jid` (best-effort, `null` se não achar).
2. Insert em `atendimento.mensagens` (`direcao='entrada'`, `remetente_tipo='cliente'`,
   `conteudo=message.content`, `wa_message_id=message.messageId`, `onConflict:'wa_message_id'` —
   idempotente, mesmo padrão do upsert de `wa_messages`).

Nenhuma linha do fluxo existente (HMAC, `wa_queue`, `scheduleAgent`) é alterada ou reordenada.

### 4. `pcm-ze-agent/index.ts` — mudanças pontuais em `processarItem`/`InputSchema`
1. Antes de `deveAcionarZe` (hoje linha ~95): buscar `atendimento.conversas.modo` por
   `(instance_id, remote_jid)`; se `'pausado'`, tratar como `modo='off'` só para aquela conversa
   (config do condomínio, `config.modo`, permanece o que já é).
2. Nos 2 pontos que chamam `responderEvolution` (pergunta incompleta linha ~102, confirmação de
   OS linha ~129): espelhar em `atendimento.mensagens` (`direcao='saida'`, `remetente_tipo='ze'`,
   `status_entrega` conforme sucesso/erro da chamada Evolution).
3. Depois do insert em `pcm.ordens_servico` (linha ~108-127): `update atendimento.conversas set
   ordem_servico_id = os.id where instance_id = ... and remote_jid = ...`.
4. `InputSchema` ganha `forcar: z.boolean().optional()`. Quando `true`: `buscarPendencias` ignora
   o filtro `status='pending'`/`wait_until` (processa a janela atual do `queueKey` como um run
   ad-hoc) e `processarItem` ignora o check de `modo` do item 1 (humano pediu explicitamente via
   "Responder com IA agora", `E02-S02`). Nenhuma mudança na assinatura pública quebra o cron de
   fallback existente (chama sem `forcar`, comportamento idêntico a hoje).

### 5. `atendimento-whatsapp-envio/index.ts` (Edge Function nova)
Recebe `{ conversaId, acao: "enviar" | "assumir" | "devolver", texto? }` de usuário autenticado.

- **`enviar`**: lê a conversa via client autenticado do chamador (RLS decide se pode — mesmo
  padrão de `config-gerenciar-usuario`: userClient com anon key + JWT do chamador para tudo que a
  RLS já resolve, service role só para o que exige segredo); insere mensagem
  (`remetente_tipo='humano'`, `remetente_id=userId`, `status_entrega='enviando'`) via o mesmo
  userClient — a RLS de escrita autoriza ou barra, a função não reimplementa a regra; chama
  `_shared/evolution.ts`; atualiza `status_entrega` (`'enviado'`/`'erro'`+`erro_detalhe`) e
  `conversas` (`ultima_mensagem_*`, e `modo='pausado'`+`atribuido_a=userId` como rede de
  segurança — evita Zé e humano responderem em paralelo se o humano mandar mensagem manual sem
  ter clicado "assumir" antes).
- **`assumir`**: `update conversas set modo='pausado', atribuido_a=userId`.
- **`devolver`**: `update conversas set modo='auto'` (mantém `atribuido_a` como histórico).

`assumir`/`devolver` não precisam de segredo — tecnicamente poderiam ser update direto no adapter
do frontend (RLS já autoriza), mas ficam como ações desta mesma função por simplicidade de
superfície (uma Edge Function fina, três ações, em vez de multiplicar funções).

## Contrato de dados
Reaproveita o parsing já existente em `pcm-whatsapp-webhook` (`extractMessage`) e
`pcm-ze-agent` (`splitQueueKey`, `buscarConfig`) — nenhum mapeamento novo de campo Auvo/Evolution
a descobrir.

## Riscos
- `pcm-whatsapp-webhook`/`pcm-ze-agent` são código de produção ativo desde `E01-S02` — mudanças
  feitas como adições em pontos específicos já identificados linha a linha, sem tocar a lógica de
  HMAC/fila/LLM existente. Revisão manual obrigatória (sem Deno CLI neste ambiente para
  type-check automático).
- `client_id` nullable em `conversas` é intencional (AC-4 de `spec.md`) — não é um bug, é o estado
  esperado até o condomínio ter `config_ze` configurada.
