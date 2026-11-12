---
name: plan
description: Detalhe técnico de E02-S36 — rota, ordem de verificação, SQL, classificador. Puxe ao implementar.
alwaysApply: false
---

# Plan — E02-S36 · Webhook Evolution por canal

## Arquivos

```
supabase/functions/atendimento-evolution-webhook/
  index.ts          handler: ordem de verificação + despacho
  classificar.ts    classificador total (espelho de domain/evento-evolution.ts)
supabase/functions/_shared/
  evolution-webhook.ts  (altera) mantém extractEvolutionMessage para o caminho legado
  crypto.ts             (usa) constantTimeEqual já existe
apps/web/src/features/atendimento/
  domain/evento-evolution.ts   (novo, puro) ESPELHO do classificador
```

> **Espelho obrigatório.** `classificar.ts` (Deno) e `domain/evento-evolution.ts` (Vite) têm a mesma
> lógica. Um teste de paridade compara a saída dos dois para uma bateria de payloads fixos.

## Ordem de verificação no handler — não negociável

```
1. method !== 'POST'                      -> 405
2. canalId = último segmento do path      -> ausente: 404 canal_nao_identificado
3. segredo = cofre(canal.webhook_secret_ref)
   apresentado = header 'x-sinergica-evolution-webhook'
   !iguaisEmTempoConstante                -> 401 recusado        <-- ANTES de ler o corpo
4. rate limit `evolution:{canalId}`       -> 429
5. corpo: content-type JSON (415), <=256 KB (413), JSON válido (400)
6. instância declarada no corpo != canal  -> 409 canal_divergente
7. reserva idempotência (canal, event, id)-> duplicado: 200 { duplicado: true }
8. classifica e despacha
```

O passo 3 antes do 5 é o ponto inteiro da story: **nenhuma PII é parseada sem segredo válido**.

## Migration `1832_E02-S36_evolution_inbox.sql`

```sql
create table if not exists atendimento.evolution_inbox (
  canal_id          uuid not null references atendimento.canais_externos(id) on delete cascade,
  event_type        text not null check (length(event_type) between 1 and 60),
  remote_message_id text not null check (length(remote_message_id) between 1 and 120),
  recebido_em       timestamptz not null default now(),
  primary key (canal_id, event_type, remote_message_id)
);

alter table atendimento.evolution_inbox enable row level security;
alter table atendimento.evolution_inbox force  row level security;
revoke all on table atendimento.evolution_inbox from public, anon, authenticated;
grant select, insert, delete on table atendimento.evolution_inbox to service_role;

alter table atendimento.mensagens
  add column if not exists canal_id uuid references atendimento.canais_externos(id);
alter table atendimento.conversas
  add column if not exists canal_id uuid references atendimento.canais_externos(id);

-- Backfill: resolve pelo instance_id já gravado na conversa
update atendimento.conversas c set canal_id = ce.id
  from atendimento.canais_externos ce
 where ce.tipo = 'evolution' and ce.identificador_externo = c.instance_id and c.canal_id is null;

create index if not exists idx_conversas_canal on atendimento.conversas (canal_id);
```

> `mensagens.wa_message_id` **continua** `unique` por compatibilidade. O oráculo de idempotência passa
> a ser `evolution_inbox`; a reserva acontece **antes** da escrita, na mesma transação da RPC.

## RPC `atendimento.fn_registrar_mensagem_evolution`

```sql
create or replace function atendimento.fn_registrar_mensagem_evolution(
  p_canal_id uuid, p_event_type text, p_remote_id text,
  p_remote_jid text, p_contato_nome text,
  p_tipo text, p_conteudo text, p_recebido_em timestamptz
) returns table (mensagem_id uuid, conversa_id uuid, duplicado boolean)
language plpgsql security definer set search_path = atendimento, public as $$
begin
  -- 1. reserva inbox (a PK faz o trabalho)
  insert into atendimento.evolution_inbox (canal_id, event_type, remote_message_id)
  values (p_canal_id, p_event_type, p_remote_id)
  on conflict do nothing;
  if not found then
    return query select null::uuid, null::uuid, true;  -- duplicado
    return;
  end if;
  -- 2. resolve/cria conversa do CANAL (nunca de outro)
  -- 3. grava mensagem + atualiza prévia/não lidas, no MESMO commit
end $$;

revoke all on function atendimento.fn_registrar_mensagem_evolution(...)
  from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_mensagem_evolution(...) to service_role;
```

Mensagem e atualização da conversa gravam **na mesma transação** da reserva. Falha em qualquer ponto
libera a reserva por rollback — sem inbox órfã.

## Classificador

```ts
export type EventoClassificado =
  | { tipo: 'texto';    remoteJid: string; remoteId: string; texto: string
      pushName?: string; citacaoRemoteId?: string }
  | { tipo: 'audio';    remoteJid: string; remoteId: string
      audio: { mimeType: string; nome: string; duracaoSegundos?: number } }
  | { tipo: 'midia';    remoteJid: string; remoteId: string
      conteudo: 'imagem'|'video'|'documento'|'figurinha'; legenda: string | null }
  | { tipo: 'aviso';    remoteJid: string; remoteId: string
      aviso: 'localizacao'|'contato'|'enquete'|'outro' }
  | { tipo: 'reacao';   remoteJid: string; remoteIdReagido: string; emoji: string }
  | { tipo: 'aparelho'; remoteJid: string; remoteId: string }     // key.fromMe === true
  | { tipo: 'ignorar';  motivo: string }

export function classificarEventoEvolution(payload: unknown): EventoClassificado
```

Ordem interna (idêntica ao `rosefish`):

1. `event !== MESSAGES_UPSERT` → `ignorar: 'evento_nao_upsert'`
2. falta `data`/`key`/`message`, ou `remoteJid`/`key.id` não são string → `ignorar: 'payload_invalido'`
3. `key.fromMe === true` → `aparelho` (nesta story segue para o caminho legado de celular)
4. `@g.us` → `ignorar: 'grupo'` · `@broadcast` → `ignorar: 'status'`
5. `protocolMessage` → `ignorar: 'protocolo'`
6. `reactionMessage` → `reacao` (emoji vazio = remoção)
7. desembrulha até 3 níveis (`ephemeralMessage`, `documentWithCaptionMessage`, `viewOnceMessage`,
   `viewOnceMessageV2`, `viewOnceMessageV2Extension`)
8. `conversation` ou `extendedTextMessage.text` → `texto` (+ `contextInfo.stanzaId` quando houver, em
   `message[tipo].contextInfo` **ou** em `data.contextInfo` — a Evolution 2 manda fora)
9. `audioMessage` → `audio`
10. `imageMessage` / `videoMessage` / `documentMessage` / `stickerMessage` → `midia`
    (figurinha **nunca** tem legenda)
11. `locationMessage`/`liveLocationMessage`/`contactMessage`/`contactsArrayMessage`/
    `pollCreationMessage*`/`eventMessage`/`productMessage` → `aviso`
12. qualquer outra coisa → `ignorar: 'tipo_desconhecido'` — **nunca** texto

Nesta story, `midia`, `aviso` e `reacao` são **reconhecidos e respondidos `200 { ignorado }`**; a
persistência deles é S37/S38. Isso mantém o escopo pequeno e deixa a classificação pronta e testada.

## Instalação do webhook (completa a E02-S35)

```ts
{ enabled: true,
  url: `${SUPABASE_URL}/functions/v1/atendimento-evolution-webhook/${canalId}`,
  headers: { 'x-sinergica-evolution-webhook': segredoAleatorio },  // 32 bytes base64url
  base64: false,
  events: ['QRCODE_UPDATED','CONNECTION_UPDATE','MESSAGES_UPSERT','MESSAGES_UPDATE','SEND_MESSAGE'] }
```

O segredo é gerado com `crypto.getRandomValues`, gravado no Vault como
`SINERGICA_EVOWEBHOOK_<geracao>_<id>` e **nunca** devolvido ao browser. Um lint/teste proíbe
`?token=` ou `?secret=` na montagem da URL.

## Transição

1. Canais novos nascem no endpoint novo.
2. Canais existentes migram por "Reinstalar recebimento" na tela (E02-S35).
3. `pcm-whatsapp-webhook` fica como está até o último canal migrar; a tela sinaliza quais faltam.
4. A remoção do endpoint antigo e de `EVOLUTION_WEBHOOK_TOKEN` é a última task do porte, em story
   própria — **não** entra aqui.

## Log

Por evento: `canal_id`, `event_type`, resultado (`gravado`/`duplicado`/`ignorado:<motivo>`), latência.
Nunca telefone completo, texto, `pushName`, `apikey` nem corpo.
