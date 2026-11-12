---
name: plan
description: Detalhe técnico de E02-S37 — SQL, buckets, pipeline de mídia, proxy de anexo. Puxe ao implementar.
alwaysApply: false
---

# Plan — E02-S37 · Mídia recebida pela Evolution

## Arquivos

```
supabase/functions/_shared/evolution-midia.ts          (novo) PORTE DIRETO do rosefish
supabase/functions/atendimento-evolution-webhook/
  index.ts        (altera) despacho de 'midia' e 'aviso' -> ingerirMidia
  ingerir-midia.ts(novo)   pipeline de conferência e gravação
supabase/functions/atendimento-anexo/index.ts          (novo) proxy autenticado
apps/web/src/features/atendimento/
  domain/mensagens.ts  (altera) conteúdo tipado + anexo + aviso
  components/MensagemBubble.tsx (altera) imagem/vídeo/documento/figurinha/aviso
```

## Migration `1833_E02-S37_midia_recebida.sql`

```sql
-- 1. Colunas (todas anuláveis; linhas existentes seguem válidas)
alter table atendimento.mensagens
  add column if not exists legenda             text,
  add column if not exists conteudo_recebido   text,
  add column if not exists anexo_estado        text,
  add column if not exists anexo_bucket        text,
  add column if not exists anexo_path          text,
  add column if not exists anexo_nome          text,
  add column if not exists anexo_mime          text,
  add column if not exists anexo_tamanho_bytes bigint,
  add column if not exists anexo_duracao_seg   integer,
  add column if not exists derivada_de uuid references atendimento.mensagens(id) on delete cascade;

-- 2. CHECKs — campos do cliente, nunca da equipe (AC-14)
alter table atendimento.mensagens
  add constraint mensagens_legenda_valida check (legenda is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente'
    and tipo_conteudo in ('midia','audio')
    and length(btrim(legenda)) between 1 and 4096)) not valid,
  add constraint mensagens_conteudo_recebido_valido check (conteudo_recebido is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente' and conteudo_recebido in
      ('imagem','video','documento','figurinha','localizacao','contato','enquete','outro'))) not valid,
  add constraint mensagens_anexo_estado_valido check (anexo_estado is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente' and (
      (anexo_estado = 'guardado' and tipo_conteudo in ('midia','audio'))
      or (anexo_estado in ('acima_do_limite','tipo_nao_aceito','indisponivel')
          and tipo_conteudo = 'texto'
          and conteudo_recebido in ('imagem','video','documento','figurinha'))))) not valid,
  add constraint mensagens_anexo_bucket_valido check (anexo_bucket is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente'
    and anexo_bucket in ('atendimento-midias','atendimento-audios'))) not valid,
  add constraint mensagens_anexo_completo check (
    (anexo_estado = 'guardado') = (anexo_bucket is not null and anexo_path is not null
      and anexo_mime is not null and anexo_tamanho_bytes is not null)) not valid,
  add constraint mensagens_derivada_valida check (derivada_de is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente'
    and tipo_conteudo = 'texto' and wa_message_id is null)) not valid;

create unique index if not exists idx_mensagens_derivada_unica
  on atendimento.mensagens (derivada_de) where derivada_de is not null;

-- 3. Buckets privados
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atendimento-midias','atendimento-midias', false, 26214400, array[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
  'video/mp4','video/3gpp','video/quicktime',
  'application/pdf','text/plain','text/csv',
  'application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation']::text[])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- idem 'atendimento-audios' (25 MB, ogg/opus/mpeg/mp4/wav/webm)
```

**Sem política em `storage.objects`:** só `service_role` lê e grava. O browser nunca recebe URL do
Storage nem signed URL.

### `1834_E02-S37_transcricao_mesma_mensagem.sql`

```sql
create or replace function atendimento.fn_concluir_transcricao_audio(
  p_mensagem_id uuid, p_texto text, p_sucesso boolean) returns void ...
```

Passa a gravar a transcrição **na própria mensagem do áudio** (coluna `conteudo`), em vez de inserir
mensagem nova. Transcrição que falhou grava `anexo_estado='guardado'` e `conteudo = null`, e a UI mostra
"Transcrição indisponível". Migrations antigas que inseriam a segunda mensagem **não são editadas** —
a função é substituída por `create or replace`, que é aditivo.

### Helper de permissão

```sql
create or replace function atendimento.fn_pode_ler_conversa(p_conversa_id uuid)
  returns boolean language sql stable security definer set search_path = atendimento, public as $$
  select auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura','escrita') $$;
```

Ponto único, chamado pelo proxy de anexo e (adiante) pela policy de reações.

## `_shared/evolution-midia.ts` — porte direto

Copiado de `rosefish/supabase/functions/evolution-webhook/midia.ts`, com os rótulos em PT já prontos:

```ts
export function normalizarMime(v: unknown): string | null
export function mimeAceito(conteudo: ConteudoDeMidia, mime: string | null): boolean
export function limiteDe(conteudo: ConteudoDeMidia): number
export function extensaoPerigosa(nome: string): boolean
export function sanearNome(nome: string|null, mime: string|null, remoteId: string): string
export function nomeParaChave(nome: string): string
export function midiaDaMensagem(mensagem, remoteId): MidiaRecebida | null
export function avisoDaMensagem(mensagem): ConteudoDeAviso | null
export function textoParaAgente(midia: MidiaRecebida): string | null
export function textoDeMidiaNaoGuardada(midia, estado): string
export function textoDeAviso(aviso): string
```

Constantes: `LIMITES = { imagem: 10MB, figurinha: 10MB, video: 16MB, documento: 25MB }`,
`EXTENSOES_PERIGOSAS`, `LEGENDA_MAXIMA = 4096`, `TEXTO_PARA_AGENTE_MAXIMO = 4000`.

## Pipeline `ingerirMidia`

```
1. extensaoPerigosa(nome) || (mime !== '' && !mimeAceito)  -> tipo_nao_aceito   (sem baixar)
2. tamanhoDeclarado > limite                               -> acima_do_limite  (sem baixar)
3. baixar da Evolution:
     POST {urlBase}/chat/getBase64FromMediaMessage/{nomeRemoto}
     headers: { apikey: <token DA INSTÂNCIA>, content-type: application/json }
     body:    { message: { key: { id: remoteId } }, convertToMp4: false }
     redirect: 'error', timeout 20 s
     teto de base64 = ceil(limite * 4 / 3) + 200, conferido no content-length E no corpo
   falha 'midia_grande_demais' -> acima_do_limite; qualquer outra -> indisponivel
4. arquivo real: size === 0 -> indisponivel; size > limite -> acima_do_limite;
   !mimeAceito(mime real) -> tipo_nao_aceito
5. salva em atendimento-midias sob `{canalId}/{remoteId}/{nomeParaChave(nome)}`
   -> anexo_estado = 'guardado', tipo_conteudo = 'midia'
Qualquer estado != guardado -> tipo_conteudo='texto', conteudo = textoDeMidiaNaoGuardada(...)
```

A mídia **nunca** é aberta, descomprimida ou renderizada no servidor (AC-5).

## Proxy `atendimento-anexo`

Molde: `pcm-evidencia-material-segura/index.ts` (já existe e é hardened).

```
POST /functions/v1/atendimento-anexo   { mensagemId }
1. requireAuth                              -> 401
2. rate limit `anexo:{userId}` 60/60 s      -> 429
3. lê a mensagem por service_role; confere fn_pode_ler_conversa(conversa_id)
   sem permissão OU mensagem inexistente    -> MESMA resposta 404  (AC-6)
4. baixa do bucket privado com service_role, lendo em streaming com teto
5. devolve bytes:
   Content-Type: <mime da lista, nunca o declarado pelo cliente>
   X-Content-Type-Options: nosniff
   Content-Disposition: inline (imagem/vídeo/áudio) | attachment; filename="<saneado>" (documento)
   Cache-Control: private, no-store
```

Nunca devolve signed URL do Storage. Nunca aceita `bucket`/`path` vindos do corpo — só `mensagemId`.

## Domínio e UI

```ts
export type ConteudoRecebido = 'imagem'|'video'|'documento'|'figurinha'
  |'localizacao'|'contato'|'enquete'|'outro'
export type AnexoEstado = 'guardado'|'acima_do_limite'|'tipo_nao_aceito'|'indisponivel'

export interface AnexoDaMensagem {
  nome: string; mime: string; tamanhoBytes: number; duracaoSegundos?: number
}
// MensagemItem ganha: legenda, conteudoRecebido, anexoEstado, anexo
```

`MensagemBubble` passa a renderizar por `conteudoRecebido` + `anexoEstado`:
imagem/figurinha → `<img>` com lightbox · vídeo → `<video controls>` · documento → cartão com nome,
tipo, tamanho e botão baixar · áudio → player + transcrição abaixo · aviso/falha → texto com ícone.
Todos buscam os bytes pelo proxy, com `URL.createObjectURL` revogada no unmount.

## O que o Zé lê

A RPC de ingestão grava, além da mensagem, o **texto para o agente** (`textoParaAgente`). O pipeline do
Zé lê esse campo, nunca o arquivo. Mídia sem legenda (exceto figurinha) marca a conversa como
`modo='pausado'` com motivo "cliente enviou mídia sem texto".

## Log

`canal_id`, `conteudo_recebido`, `anexo_estado`, tamanho em bytes, latência. Nunca nome original,
legenda, conteúdo, telefone ou `apikey`.
