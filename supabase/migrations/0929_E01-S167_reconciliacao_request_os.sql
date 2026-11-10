-- ADR-0704: consulta privada de resultado por identidade; não inicia nem altera comandos.
create table pcm.sso_reconciliacao_request_os_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.sso_reconciliacao_request_os_gate enable row level security;
alter table pcm.sso_reconciliacao_request_os_gate force row level security;
revoke all on pcm.sso_reconciliacao_request_os_gate from public, anon, authenticated, service_role;
insert into pcm.sso_reconciliacao_request_os_gate(id,habilitado) values (true,false);

create function pcm.sso_reconciliar_request_os_chamado(
  p_cliente_id uuid, p_chamado_id uuid, p_request_id uuid, p_os_id uuid,
  p_expected_revision bigint, p_titulo text, p_descricao text, p_categoria text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_comando pcm.chamado_os_comandos%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_reconciliacao_request_os_gate where id),false) then
    raise exception 'reconciliacao_request_os_bloqueada' using errcode='55000';
  end if;
  if v_actor is null or p_cliente_id is null or p_chamado_id is null or p_request_id is null or p_os_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_titulo is null
    or length(btrim(p_titulo)) not between 1 and 200 or p_categoria is null
    or p_categoria not in ('preventiva','corretiva','emergencial') then
    raise exception 'pedido_invalido' using errcode='22023';
  end if;
  if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  select * into v_comando from pcm.chamado_os_comandos where request_id=p_request_id;
  if not found then
    return jsonb_build_object('requestId',p_request_id,'estado','indeterminado','autorizaNovaCriacao',false);
  end if;
  if v_comando.actor_id is distinct from v_actor or v_comando.cliente_id is distinct from p_cliente_id
    or v_comando.chamado_id is distinct from p_chamado_id then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  if v_comando.payload is distinct from jsonb_build_object('chamadoId',p_chamado_id,'clienteId',p_cliente_id,
      'expectedRevision',p_expected_revision,'osId',p_os_id,'titulo',btrim(p_titulo),
      'descricao',p_descricao,'categoria',p_categoria)
    or v_comando.resultado->>'requestId' is distinct from p_request_id::text
    or v_comando.resultado->>'chamadoId' is distinct from p_chamado_id::text
    or v_comando.resultado->>'osId' is distinct from p_os_id::text then
    raise exception 'identidade_request_incompativel' using errcode='23514';
  end if;
  if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  return jsonb_build_object('requestId',p_request_id,'estado','confirmado',
    'resultado',v_comando.resultado,'autorizaNovaCriacao',false);
end; $$;
revoke all on function pcm.sso_reconciliar_request_os_chamado(uuid,uuid,uuid,uuid,bigint,text,text,text)
  from public,anon,authenticated,service_role;
