-- 0067_E02-S16_meta_runtime.sql — provider explícito e ingestão multicanal Meta.
-- Reverso: drop function atendimento.fn_registrar_mensagem_canal; drop column provedor.

alter table atendimento.conversas
  add column if not exists provedor text not null default 'evolution'
  check (provedor in ('evolution', 'meta'));

alter table atendimento.canais_externos
  add column if not exists waba_id text;

create or replace function atendimento.fn_registrar_mensagem_canal(
  p_instance_id text,
  p_remote_jid text,
  p_contato_nome text,
  p_conteudo text,
  p_message_id text,
  p_canal text,
  p_provedor text
) returns uuid
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_conversa_id uuid;
  v_mensagem_id uuid;
begin
  if p_canal not in ('whatsapp', 'instagram', 'messenger') then
    raise exception 'canal inválido';
  end if;
  insert into atendimento.conversas (
    instance_id, remote_jid, contato_nome, canal, provedor
  ) values (
    p_instance_id, p_remote_jid, p_contato_nome, p_canal, p_provedor
  )
  on conflict (instance_id, remote_jid) do update set
    contato_nome = coalesce(excluded.contato_nome, atendimento.conversas.contato_nome),
    canal = excluded.canal,
    provedor = excluded.provedor
  returning id into v_conversa_id;

  insert into atendimento.mensagens (
    conversa_id, direcao, remetente_tipo, conteudo, wa_message_id
  ) values (
    v_conversa_id, 'entrada', 'cliente', p_conteudo, p_message_id
  )
  on conflict (wa_message_id) do nothing
  returning id into v_mensagem_id;

  if v_mensagem_id is not null then
    update atendimento.conversas set
      nao_lidas = nao_lidas + 1,
      ultima_mensagem_preview = left(p_conteudo, 200),
      ultima_mensagem_em = now(),
      updated_at = now()
    where id = v_conversa_id;
  end if;
  return v_conversa_id;
end;
$$;

revoke all on function atendimento.fn_registrar_mensagem_canal(text,text,text,text,text,text,text) from public;
grant execute on function atendimento.fn_registrar_mensagem_canal(text,text,text,text,text,text,text) to service_role;
