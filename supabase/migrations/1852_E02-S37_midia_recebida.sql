-- 1852_E02-S37_midia_recebida.sql — Sinérgica SO
--
-- SPEC_DEVIATION (plan.md previa colunas anexo_* e bucket/proxy novos; a Sinérgica JÁ TEM
-- `atendimento.mensagens.midia_url/midia_nome/midia_mime` e o bucket privado `atendimento-midias`
-- desde a migration 0063/E02-S21 — com RLS por sessão (authenticated + módulo atendimento), não
-- por proxy service_role. O adapter já gera signed URL a partir de `midia_url` (caminho no
-- bucket). Reaproveitar é MENOS código e MAIS consistente com o resto do inbox (mesma
-- granularidade de RLS que `conversas_select`/`mensagens_select`) do que duplicar com
-- `anexo_bucket`/`anexo_path`/proxy novo. Resolução: specs/E02-S37/plan.md desatualizado nesse
-- ponto; tasks.md registra a divergência.
--
-- Também não existe hoje transcrição de áudio na Sinérgica (nenhuma função chama "transcri" em
-- supabase/functions) — não há bug de "transcrição duplicada" a corrigir; a migration
-- 1834_transcricao_mesma_mensagem do plan.md não se aplica. Áudio recebido entra pelo MESMO
-- pipeline de mídia desta migration, sem transcrição (fica para story própria).
--
-- Reverso:
--   alter table atendimento.mensagens
--     drop constraint if exists mensagens_legenda_valida,
--     drop constraint if exists mensagens_conteudo_recebido_valido,
--     drop constraint if exists mensagens_anexo_estado_valido,
--     drop column if exists legenda, drop column if exists conteudo_recebido,
--     drop column if exists anexo_estado;
--   update storage.buckets set file_size_limit = 20971520 where id = 'atendimento-midias';

-- Eleva o teto do bucket já existente para caber documento até 25MB (era 20MB desde 0063).
-- Só RELAXA o limite — não restringe mime (continua sem allowed_mime_types, como já era).
update storage.buckets set file_size_limit = 26214400 where id = 'atendimento-midias';

alter table atendimento.mensagens
  add column if not exists legenda           text,
  add column if not exists conteudo_recebido text,
  add column if not exists anexo_estado      text;

-- Campos do CLIENTE, nunca da equipe — a equipe grava mensagem direto pela tabela e não pode
-- apontar mídia/legenda/aviso alheios (mesmo espírito do mensagens_wa_message_id_* já existente).
alter table atendimento.mensagens
  add constraint mensagens_legenda_valida check (legenda is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente'
    and tipo_conteudo in ('midia', 'audio')
    and length(btrim(legenda)) between 1 and 4096
  )) not valid;

alter table atendimento.mensagens
  add constraint mensagens_conteudo_recebido_valido check (conteudo_recebido is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente' and conteudo_recebido in (
      'imagem', 'video', 'documento', 'figurinha', 'localizacao', 'contato', 'enquete', 'outro'
    )
  )) not valid;

alter table atendimento.mensagens
  add constraint mensagens_anexo_estado_valido check (anexo_estado is null or (
    direcao = 'entrada' and remetente_tipo = 'cliente' and (
      (anexo_estado = 'guardado' and tipo_conteudo in ('midia', 'audio'))
      or (anexo_estado in ('acima_do_limite', 'tipo_nao_aceito', 'indisponivel')
          and tipo_conteudo = 'texto'
          and conteudo_recebido in ('imagem', 'video', 'documento', 'figurinha'))
    )
  )) not valid;

alter table atendimento.mensagens validate constraint mensagens_legenda_valida;
alter table atendimento.mensagens validate constraint mensagens_conteudo_recebido_valido;
alter table atendimento.mensagens validate constraint mensagens_anexo_estado_valido;

-- Ingestão de mídia/aviso: espelha fn_registrar_mensagem_evolution (1848), mesma reserva de
-- idempotência no inbox, mas grava midia_url/midia_nome/midia_mime (colunas existentes) e o
-- texto que o Zé lê (nunca o conteúdo do arquivo) na mesma mensagem.
create or replace function atendimento.fn_registrar_midia_evolution(
  p_canal_id uuid,
  p_event_type text,
  p_remote_id text,
  p_instance_id text,
  p_remote_jid text,
  p_tipo_conteudo text,          -- 'midia' | 'audio' | 'texto' (aviso / não guardado)
  p_conteudo_recebido text,      -- imagem|video|documento|figurinha|localizacao|contato|enquete|outro
  p_legenda text,
  p_conteudo text,               -- texto mostrado (Zé/equipe) quando tipo_conteudo='texto'
  p_midia_url text,              -- caminho no bucket, só quando guardado
  p_midia_nome text,
  p_midia_mime text,
  p_anexo_estado text
) returns table (mensagem_id uuid, conversa_id uuid, duplicado boolean)
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_client_id uuid;
  v_inserted_message_id uuid;
begin
  insert into atendimento.evolution_inbox (canal_id, event_type, remote_message_id)
  values (p_canal_id, p_event_type, p_remote_id)
  on conflict do nothing;
  if not found then
    return query select null::uuid, null::uuid, true;
    return;
  end if;

  select client_id into v_client_id
    from atendimento.config_ze where group_jid = p_remote_jid limit 1;

  insert into atendimento.conversas (instance_id, remote_jid, client_id, canal_id)
  values (p_instance_id, p_remote_jid, v_client_id, p_canal_id)
  on conflict (instance_id, remote_jid) do update
    set canal_id = coalesce(atendimento.conversas.canal_id, excluded.canal_id)
  returning id into v_conversa_id;

  insert into atendimento.mensagens (
    conversa_id, direcao, remetente_tipo, conteudo, tipo_conteudo, wa_message_id, canal_id,
    legenda, conteudo_recebido, anexo_estado, midia_url, midia_nome, midia_mime
  )
  values (
    v_conversa_id, 'entrada', 'cliente', p_conteudo, p_tipo_conteudo, p_remote_id, p_canal_id,
    p_legenda, p_conteudo_recebido, p_anexo_estado, p_midia_url, p_midia_nome, p_midia_mime
  )
  on conflict do nothing
  returning id into v_inserted_message_id;

  if v_inserted_message_id is not null then
    update atendimento.conversas
       set nao_lidas = nao_lidas + 1,
           ultima_mensagem_preview = left(coalesce(p_legenda, p_conteudo, '[' || coalesce(p_conteudo_recebido, 'mídia') || ']'), 200),
           ultima_mensagem_em = now(),
           updated_at = now()
     where id = v_conversa_id;
  end if;

  return query select v_inserted_message_id, v_conversa_id, false;
end;
$$;

revoke all on function atendimento.fn_registrar_midia_evolution(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_midia_evolution(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;

comment on function atendimento.fn_registrar_midia_evolution(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) is 'E02-S37: ingestão de mídia/aviso, reusando midia_url/midia_nome/midia_mime existentes (0063). Mesma reserva de idempotência de fn_registrar_mensagem_evolution.';
