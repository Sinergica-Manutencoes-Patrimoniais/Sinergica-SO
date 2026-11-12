---
name: plan
description: Detalhe técnico de E02-S40 — SQL, bucket, reserva de 7 dias, proxy, preenchimento inicial. Puxe ao implementar.
alwaysApply: false
---

# Plan — E02-S40 · Foto do WhatsApp do contato

## Decisão estrutural

No TriviAtende a foto pertence a `lead.contato` (a identidade de WhatsApp num canal). A Sinérgica não
tem essa entidade — mas `atendimento.conversas` já é **único por `(instance_id, remote_jid)`**, que é
exatamente "contato naquele canal". **A foto é ancorada na conversa.** Equivalente, e evita criar uma
entidade nova só por isso.

Consequência esperada e aceita: o mesmo número em dois canais Evolution tem duas fotos, uma por
conversa — que é o comportamento do TriviAtende também ("vale a foto do contato do canal da Conversa").

## Migration `1838_E02-S40_foto_de_contato.sql`

```sql
create table if not exists atendimento.foto_de_contato (
  conversa_id   uuid primary key references atendimento.conversas(id) on delete cascade,
  estado        text not null check (estado in ('guardada','sem_foto','falhou')),
  mime          text check (mime in ('image/jpeg','image/png','image/webp')),
  hash          text check (hash ~ '^[0-9a-f]{64}$'),
  consultada_em timestamptz not null default clock_timestamp(),
  atualizada_em timestamptz,
  constraint foto_guardada_completa check (
    (estado = 'guardada') = (mime is not null and hash is not null))
);

alter table atendimento.foto_de_contato enable row level security;
alter table atendimento.foto_de_contato force  row level security;
revoke all on table atendimento.foto_de_contato from public, anon, authenticated;
grant select, insert, update, delete on table atendimento.foto_de_contato to service_role;

-- Cópia de leitura para a lista não pedir imagem que não existe (AC-6)
alter table atendimento.conversas
  add column if not exists foto_em   timestamptz,
  add column if not exists foto_hash text;

-- Bucket privado, sem política em storage.objects: só service_role
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atendimento-fotos-contato','atendimento-fotos-contato', false, 1048576,
        array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
```

### Reserva atômica da consulta (AC-7)

```sql
create or replace function atendimento.fn_reservar_consulta_de_foto(
  p_conversa_id uuid, p_intervalo interval default interval '7 days')
returns boolean language plpgsql security definer set search_path = atendimento, public as $$
begin
  insert into atendimento.foto_de_contato (conversa_id, estado, consultada_em)
  values (p_conversa_id, 'falhou', clock_timestamp())
  on conflict (conversa_id) do update
     set consultada_em = clock_timestamp()
   where atendimento.foto_de_contato.consultada_em < clock_timestamp() - p_intervalo;
  return found;   -- false = dentro da janela, NÃO consulta
end $$;
```

A reserva marca `consultada_em` **antes** da consulta: duas mensagens seguidas só conseguem uma reserva.
Linha nova nasce `falhou` e vira `guardada`/`sem_foto` quando o resultado chega.

```sql
create or replace function atendimento.fn_registrar_foto_de_contato(
  p_conversa_id uuid, p_estado text, p_mime text, p_hash text) returns void ...
-- estado='sem_foto' apaga o arquivo guardado e zera conversas.foto_hash (AC-8)
-- estado='guardada' grava mime/hash e atualiza conversas.foto_em / foto_hash (AC-9)

create or replace function atendimento.fn_conversas_para_foto_inicial(p_limite integer)
  returns table (conversa_id uuid, canal_id uuid, remote_jid text) ...
-- conversas ativas de canais Evolution, respeitando o intervalo, com teto (AC-13)
```

## Busca — `_shared/foto-do-contato.ts`

```ts
export interface EntradaDaFoto { canalId: string; conversaId: string; remoteJid: string }
export async function atualizarFotoDoContato(entrada, deps): Promise<void>
```

Pipeline:

```
1. fn_reservar_consulta_de_foto -> false: retorna sem fazer nada          (AC-7)
2. POST {urlBase}/chat/fetchProfilePictureUrl/{nomeRemoto}
   headers { apikey: <token DA INSTÂNCIA> }  body { number: remoteJid }
   sem URL na resposta -> fn_registrar_foto_de_contato('sem_foto')        (AC-8)
3. confere a URL devolvida: host precisa ser do WhatsApp
   (*.whatsapp.net / *.cdn.whatsapp.net / pps.whatsapp.net), HTTPS, sem credencial  (AC-4)
4. baixa com redirect:'error', timeout 10 s, lendo em streaming com teto de 1 MB
5. confere a ASSINATURA do arquivo, não o content-type:                   (AC-4)
   JPEG FF D8 FF · PNG 89 50 4E 47 0D 0A 1A 0A · WebP "RIFF"…"WEBP"
   divergente -> 'falhou'
6. hash = SHA-256 dos bytes
   hash igual ao guardado -> só atualiza consultada_em, não regrava
7. salva em atendimento-fotos-contato/{conversaId}.{ext}
   fn_registrar_foto_de_contato('guardada', mime, hash)
Qualquer exceção -> 'falhou', engolida: nunca sobe para o caminho da mensagem  (AC-2)
```

## Disparo pelo webhook (AC-2, AC-14)

```ts
function dispararFotoDoPerfil(deps, canalId, conversaId, remoteJid, duplicado): void {
  if (duplicado) return
  let tarefa: Promise<unknown>
  try { tarefa = deps.atualizarFoto({ canalId, conversaId, remoteJid }).catch(() => undefined) }
  catch { return }
  if (deps.emSegundoPlano === undefined) void tarefa
  else deps.emSegundoPlano(tarefa)          // EdgeRuntime.waitUntil
}
```

Chamado **depois** de a mensagem estar persistida, só no caminho de **entrada** (`fromMe === false`) e
só quando o canal é `evolution-api`. Nunca em `aparelho`, `reacao` ou `ignorar`.

## Leitura pela tela

`atendimento-anexo` ganha uma segunda rota (ou um `tipo: 'foto'` no corpo):

```
POST /functions/v1/atendimento-anexo  { tipo: 'foto', conversaId }
1. requireAuth
2. fn_pode_ler_conversa(conversaId) -> false: MESMO 404 de foto inexistente   (AC-10)
3. baixa do bucket privado com service_role, teto de 1 MB
4. Content-Type: <mime guardado>  ·  X-Content-Type-Options: nosniff
   Cache-Control: private, max-age=604800, immutable  (a versão vem no hash)  (AC-9)
```

A UI só pede a foto quando `conversas.foto_hash !== null` (AC-6), e a chave do cache do lado do cliente
inclui o hash. `onError` do `<img>` cai para as iniciais (AC-5).

## Preenchimento inicial (AC-13)

Edge Function `atendimento-preencher-fotos`, só superadmin:

```
POST { limite?: number }   // default 100, teto 500
1. fn_conversas_para_foto_inicial(limite)
2. para cada: atualizarFotoDoContato, em série, com pausa curta entre chamadas
3. devolve { processadas, guardadas, semFoto, falhas }
```

Idempotente por construção: a reserva de 7 dias impede reprocessar. Runbook em
`docs/runbooks/` (molde: `rosefish/docs/runbooks/preencher-fotos-evolution.md`).

## Log (AC-11)

Por consulta: `canal_id`, `conversa_id`, resultado (`guardada`/`sem_foto`/`falhou`), tamanho, latência.
**Nunca** a URL do WhatsApp, os bytes, o `remote_jid` nem o telefone.

## Débito

`docs/SECURITY_DEBT.md`: quando existir exclusão de dados a pedido do titular, ela precisa apagar
`atendimento.foto_de_contato` e os objetos de `atendimento-fotos-contato` do contato.
