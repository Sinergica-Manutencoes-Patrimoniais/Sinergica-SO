-- ADR-1359: confirma reserva somente contra vínculo local já existente; sem chamada Auvo.
create table pcm.sso_reconciliar_reserva_legada_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_reconciliar_reserva_legada_gate(id,habilitado) values(true,false);
create table pcm.sso_reconciliar_reserva_legada_comandos(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_reconciliar_reserva_legada_gate enable row level security;
alter table pcm.sso_reconciliar_reserva_legada_gate force row level security;
alter table pcm.sso_reconciliar_reserva_legada_comandos enable row level security;
alter table pcm.sso_reconciliar_reserva_legada_comandos force row level security;
revoke all on pcm.sso_reconciliar_reserva_legada_gate, pcm.sso_reconciliar_reserva_legada_comandos from public,anon,authenticated,service_role;
create trigger sso_reconciliar_reserva_legada_comandos_imutaveis before update or delete on pcm.sso_reconciliar_reserva_legada_comandos
  for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_reconciliar_reserva_com_vinculo(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_reserva_id uuid,p_tarefa text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_comando pcm.sso_reconciliar_reserva_legada_comandos%rowtype;
  v_reserva pcm.sso_reservas_envio_legado%rowtype;v_tarefa bigint;v_local bigint;v_payload jsonb;v_resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_reconciliar_reserva_legada_gate where id and habilitado for share;
  if not found then raise exception 'reconciliacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_reserva_envio_legado_gate where id and habilitado for share;
  if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_reserva_id is null
    or p_tarefa is null or p_tarefa !~ '^[1-9][0-9]{0,15}$' or p_tarefa::numeric>9007199254740991
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  v_tarefa:=p_tarefa::bigint;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'reservaId',p_reserva_id,'tarefa',p_tarefa,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliar-reserva-legada:'||p_request_id::text,0));
  select * into v_comando from pcm.sso_reconciliar_reserva_legada_comandos where request_id=p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.cliente_id is distinct from p_cliente_id or v_comando.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-os:'||p_os_id::text,0)) then raise exception 'os_em_alteracao' using errcode='55P03'; end if;
  select o.auvo_task_id into v_local from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null for update nowait;
  if not found or v_local is distinct from v_tarefa then raise exception 'vinculo_local_nao_confirmado' using errcode='23514'; end if;
  select * into v_reserva from pcm.sso_reservas_envio_legado where id=p_reserva_id and os_id=p_os_id and cliente_id=p_cliente_id for update;
  if not found or (v_reserva.estado='confirmado' and v_reserva.tarefa_id is distinct from v_tarefa) then raise exception 'reserva_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_reserva.estado='pendente' then
    update pcm.sso_reservas_envio_legado set estado='confirmado',tarefa_id=v_tarefa,confirmado_em=now() where id=p_reserva_id;
  end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'osId',p_os_id,'reservaId',p_reserva_id,
    'tarefa',p_tarefa,'estado','confirmado','efeitoRemotoComprovado',false,'tarefaAuvoCriada',false);
  insert into pcm.sso_reconciliar_reserva_legada_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,p_cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'material.reserva_reconciliada_vinculo_local','ordens_servico',p_os_id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_reconciliar_reserva_com_vinculo(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliar_reserva_com_vinculo(uuid,uuid,uuid,uuid,text,text) to authenticated;
