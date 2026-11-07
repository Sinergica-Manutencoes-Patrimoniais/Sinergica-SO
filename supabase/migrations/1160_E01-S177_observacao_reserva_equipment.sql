-- ADR-1008: observação declarada, sem liberação de reserva ou envio.
create table pcm.sso_observacao_reserva_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_observacao_reserva_gate(id,habilitado) values(true,false);
create table pcm.sso_observacoes_reserva_equipment (
  request_id uuid primary key, outbox_id uuid not null references pcm.auvo_sync_outbox(id),
  componente_id uuid not null references pcm.equipamentos(id), cliente_id uuid not null references pcm.clientes(id),
  ator_id uuid not null references auth.users(id), observacao text not null check(pg_catalog.length(pg_catalog.btrim(observacao)) between 1 and 2000),
  criado_em timestamptz not null default now()
);
alter table pcm.sso_observacao_reserva_gate enable row level security;
alter table pcm.sso_observacao_reserva_gate force row level security;
alter table pcm.sso_observacoes_reserva_equipment enable row level security;
alter table pcm.sso_observacoes_reserva_equipment force row level security;
revoke all on pcm.sso_observacao_reserva_gate,pcm.sso_observacoes_reserva_equipment from public,anon,authenticated,service_role;
create function pcm.sso_guardar_observacao_reserva() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'observacao_reserva_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_guardar_observacao_reserva() from public,anon,authenticated,service_role;
create trigger sso_observacao_reserva_imutavel before update or delete on pcm.sso_observacoes_reserva_equipment for each row execute function pcm.sso_guardar_observacao_reserva();

create function pcm.sso_observar_reserva_equipment(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_outbox_id uuid,p_componente_id uuid,p_observacao text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_antes pcm.sso_observacoes_reserva_equipment%rowtype; v_texto text;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_request_id is null or p_outbox_id is null or p_componente_id is null or p_observacao is null or pg_catalog.length(pg_catalog.btrim(p_observacao)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_observacao_reserva_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'observacao_reserva_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_texto:=pg_catalog.btrim(p_observacao);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('observacao-reserva:' || p_request_id::text,0));
  select * into v_antes from pcm.sso_observacoes_reserva_equipment where request_id=p_request_id;
  if found then
    if v_antes.ator_id is distinct from p_ator_id or v_antes.cliente_id is distinct from p_cliente_id then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_antes.outbox_id is distinct from p_outbox_id or v_antes.componente_id is distinct from p_componente_id or v_antes.observacao is distinct from v_texto then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return pg_catalog.jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id,'componenteId',p_componente_id,'criadoEm',v_antes.criado_em);
  end if;
  perform 1 from pcm.sso_reserva_equipment_outbox r join pcm.equipamentos e on e.id=r.componente_id
    where r.outbox_id=p_outbox_id and r.componente_id=p_componente_id and e.client_id=p_cliente_id for share of r,e;
  if not found then raise exception 'reserva_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_observacoes_reserva_equipment(request_id,outbox_id,componente_id,cliente_id,ator_id,observacao)
    values(p_request_id,p_outbox_id,p_componente_id,p_cliente_id,p_ator_id,v_texto) returning * into v_antes;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'equipment.reserva_observada','auvo_sync_outbox',p_outbox_id,
    pg_catalog.jsonb_build_object('clienteId',p_cliente_id,'componenteId',p_componente_id,'requestId',p_request_id));
  return pg_catalog.jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id,'componenteId',p_componente_id,'criadoEm',v_antes.criado_em);
end;
$$;
revoke all on function pcm.sso_observar_reserva_equipment(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
