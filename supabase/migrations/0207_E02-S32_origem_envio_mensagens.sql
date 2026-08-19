-- 0207_E02-S32_origem_envio_mensagens.sql — Sinérgica SO
-- E02-S32 AC-1/AC-2: distingue COMO uma mensagem de saída foi enviada (formulário do app, IA, ou
-- celular pessoal via WhatsApp) — `remetente_tipo='humano'` sozinho não bastava pra isso (cobria
-- formulário e celular igual). Só mensagens de saída têm origem_envio; entrada fica null.
--
-- `fn_registrar_mensagem_celular` espelha `fn_registrar_mensagem_entrada` (migration 0039): dedup
-- por wa_message_id, resolve/cria conversa, mas NÃO incrementa nao_lidas (AC-2 — só entrada conta
-- como não lida) e usa o timestamp real do evento Evolution, não now() (AC-3).
--
-- RECONSTRUÍDA nesta sessão (E01-S146) — ver nota em 0205_E02-S31_ia_gasto_log.sql. Achada ao
-- investigar por que mensagens enviadas pelo celular não aparecem no Atendimento (2026-08-19) —
-- esta função existe e está aplicada em produção, mas nada no código do app/webhook a invoca
-- ainda (ver STATE.md).
--
-- Reverso:
--   drop function if exists atendimento.fn_registrar_mensagem_celular(text,text,text,text,text,timestamptz);
--   alter table atendimento.mensagens drop column if exists origem_envio;

alter table atendimento.mensagens
  add column if not exists origem_envio text check (origem_envio in ('formulario', 'ia', 'celular'));

comment on column atendimento.mensagens.origem_envio is
  'E02-S32: como uma mensagem de saída foi enviada. NULL em mensagens de entrada.';

-- Backfill do histórico: toda mensagem de saída existente veio ou do formulário (humano) ou da IA
-- — celular é caso novo, não existe pra trás.
update atendimento.mensagens
set origem_envio = case
  when remetente_tipo in ('ze', 'agente') then 'ia'
  when remetente_tipo = 'humano' then 'formulario'
  else null
end
where direcao = 'saida' and origem_envio is null;

create or replace function atendimento.fn_registrar_mensagem_celular(
  p_instance_id text,
  p_remote_jid text,
  p_contato_nome text,
  p_conteudo text,
  p_wa_message_id text,
  p_enviado_em timestamptz
) returns uuid
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_client_id uuid;
  v_inserted_message_id uuid;
begin
  select client_id into v_client_id
    from atendimento.config_ze
    where group_jid = p_remote_jid
    limit 1;

  insert into atendimento.conversas (instance_id, remote_jid, client_id, contato_nome)
  values (p_instance_id, p_remote_jid, v_client_id, p_contato_nome)
  on conflict (instance_id, remote_jid) do update
  set contato_nome = coalesce(atendimento.conversas.contato_nome, excluded.contato_nome)
  returning id into v_conversa_id;

  insert into atendimento.mensagens
    (conversa_id, direcao, remetente_tipo, origem_envio, conteudo, wa_message_id, status_entrega, created_at)
  values
    (v_conversa_id, 'saida', 'humano', 'celular', p_conteudo, p_wa_message_id, 'enviado', p_enviado_em)
  on conflict (wa_message_id) do nothing
  returning id into v_inserted_message_id;

  if v_inserted_message_id is not null then
    update atendimento.conversas
    set ultima_mensagem_preview = left(p_conteudo, 200),
        ultima_mensagem_em = p_enviado_em,
        updated_at = now()
    where id = v_conversa_id;
  end if;

  return v_conversa_id;
end;
$$;

revoke all on function atendimento.fn_registrar_mensagem_celular(text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_mensagem_celular(text, text, text, text, text, timestamptz) to service_role;
