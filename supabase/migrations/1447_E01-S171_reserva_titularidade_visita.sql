-- ADR-1300: somente o servidor emite novas reservas canceláveis.
create table pcm.sso_reserva_criacao_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reserva_criacao_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_reserva_criacao_visita_gate enable row level security;
alter table pcm.sso_reserva_criacao_visita_gate force row level security;
revoke all on pcm.sso_reserva_criacao_visita_gate from public,anon,authenticated,service_role;
create table pcm.sso_reservas_criacao_visita(
 request_id uuid primary key,ator_id uuid not null,cliente_id uuid not null,payload jsonb not null,
 criado_em timestamptz not null default clock_timestamp()
);
alter table pcm.sso_reservas_criacao_visita enable row level security;
alter table pcm.sso_reservas_criacao_visita force row level security;
revoke all on pcm.sso_reservas_criacao_visita from public,anon,authenticated,service_role;

create function pcm.sso_reservar_criacao_visita(
 p_ator_id uuid,p_visita_id uuid,p_cliente_id uuid,p_contrato_id uuid,p_area_id uuid,p_local_id uuid,
 p_inicio_em timestamptz,p_fim_em timestamptz,p_fuso text,p_natureza text,p_responsavel_id uuid,p_deslocamento_minutos integer
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_request uuid:=pg_catalog.gen_random_uuid(); v_payload jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_visita_id is null or p_cliente_id is null
   or p_inicio_em is null or p_fim_em is null or not isfinite(p_inicio_em) or not isfinite(p_fim_em) or p_fim_em<=p_inicio_em
   or nullif(btrim(p_fuso),'') is null or p_natureza is null or p_natureza not in ('regular','extra','reposicao_manual')
   or p_deslocamento_minutos is null or p_deslocamento_minutos<0 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_reserva_criacao_visita_gate where id and habilitado for share;
 if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('tipo','criarVisitaRascunho','expectedRevision',0,'visitaId',p_visita_id,
   'clienteId',p_cliente_id,'contratoId',p_contrato_id,'areaId',p_area_id,'localId',p_local_id,'inicioEm',p_inicio_em,
   'fimEm',p_fim_em,'fuso',p_fuso,'natureza',p_natureza,'responsavelId',p_responsavel_id,'deslocamentoMinutos',p_deslocamento_minutos);
 insert into pcm.sso_reservas_criacao_visita(request_id,ator_id,cliente_id,payload) values(v_request,p_ator_id,p_cliente_id,v_payload);
 return jsonb_build_object('requestId',v_request,'visitaId',p_visita_id,'clienteId',p_cliente_id,'criaVisita',false);
end; $$;
revoke all on function pcm.sso_reservar_criacao_visita(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reservar_criacao_visita(uuid,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,uuid,integer) to authenticated;

create or replace function pcm.sso_cancelar_criacao_visita(
  p_ator_id uuid,p_request_id uuid,p_expected_revision integer,p_visita_id uuid,p_cliente_id uuid,
  p_contrato_id uuid,p_area_id uuid,p_local_id uuid,p_inicio_em timestamptz,p_fim_em timestamptz,
  p_fuso text,p_natureza text,p_responsavel_id uuid,p_deslocamento_minutos integer,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_payload jsonb; c pcm.visita_comandos%rowtype; x pcm.sso_criacao_visita_cancelamentos%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_expected_revision is distinct from 0
    or p_visita_id is null or p_cliente_id is null or p_inicio_em is null or p_fim_em is null
    or not isfinite(p_inicio_em) or not isfinite(p_fim_em) or p_fim_em<=p_inicio_em
    or nullif(btrim(p_fuso),'') is null or p_natureza is null or p_natureza not in ('regular','extra','reposicao_manual')
    or p_deslocamento_minutos is null or p_deslocamento_minutos<0 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_cancelamento_criacao_visita_gate where id and habilitado for share;
  if not found then raise exception 'cancelamento_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('tipo','criarVisitaRascunho','expectedRevision',p_expected_revision,'visitaId',p_visita_id,
    'clienteId',p_cliente_id,'contratoId',p_contrato_id,'areaId',p_area_id,'localId',p_local_id,'inicioEm',p_inicio_em,
    'fimEm',p_fim_em,'fuso',p_fuso,'natureza',p_natureza,'responsavelId',p_responsavel_id,'deslocamentoMinutos',p_deslocamento_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from pcm.visita_comandos where request_id=p_request_id;
  if found then
    if c.actor_id is distinct from p_ator_id or c.cliente_id is distinct from p_cliente_id or c.payload is distinct from v_payload
      or not exists(select 1 from pcm.visitas v where v.id=p_visita_id and v.cliente_id=p_cliente_id)
      then raise exception 'pedido_indisponivel' using errcode='42501'; end if;
    return jsonb_build_object('estado','criada','requestId',p_request_id,'resultado',c.resultado);
  end if;
  if not exists(select 1 from pcm.sso_reservas_criacao_visita r where r.request_id=p_request_id and r.ator_id=p_ator_id and r.cliente_id=p_cliente_id and r.payload=v_payload) then
    raise exception 'titularidade_nao_comprovada' using errcode='42501';
  end if;
  select * into x from pcm.sso_criacao_visita_cancelamentos where request_id=p_request_id;
  if found then
    if x.ator_id is distinct from p_ator_id or x.cliente_id is distinct from p_cliente_id or x.payload is distinct from v_payload
      or x.motivo is distinct from btrim(p_motivo) then raise exception 'pedido_indisponivel' using errcode='42501'; end if;
  else
    insert into pcm.sso_criacao_visita_cancelamentos(request_id,ator_id,cliente_id,payload,motivo)
      values(p_request_id,p_ator_id,p_cliente_id,v_payload,btrim(p_motivo));
    insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'visita.criacao_cancelada',
      'sso_criacao_visita_cancelamentos',p_request_id,jsonb_build_object('clienteId',p_cliente_id,'motivo',btrim(p_motivo)));
  end if;
  return jsonb_build_object('estado','cancelada','requestId',p_request_id);
end; $$;

create or replace function pcm.sso_criar_visita_rascunho(
  p_request_id uuid, p_expected_revision integer, p_visita_id uuid, p_cliente_id uuid,
  p_contrato_id uuid, p_area_id uuid, p_local_id uuid, p_inicio_em timestamptz, p_fim_em timestamptz,
  p_fuso text, p_natureza text, p_responsavel_id uuid, p_deslocamento_minutos integer
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_comando pcm.visita_comandos%rowtype; v_visita pcm.visitas%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0 or p_visita_id is null
    or p_cliente_id is null or p_inicio_em is null or p_fim_em is null or not isfinite(p_inicio_em) or not isfinite(p_fim_em)
    or p_fim_em <= p_inicio_em or nullif(btrim(p_fuso), '') is null or p_natureza is null
    or p_natureza not in ('regular', 'extra', 'reposicao_manual') or p_deslocamento_minutos is null or p_deslocamento_minutos < 0 then
    raise exception 'visita_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'criarVisitaRascunho', 'expectedRevision', p_expected_revision,
    'visitaId', p_visita_id, 'clienteId', p_cliente_id, 'contratoId', p_contrato_id, 'areaId', p_area_id,
    'localId', p_local_id, 'inicioEm', p_inicio_em, 'fimEm', p_fim_em, 'fuso', p_fuso,
    'natureza', p_natureza, 'responsavelId', p_responsavel_id, 'deslocamentoMinutos', p_deslocamento_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  if exists (select 1 from pcm.sso_reservas_criacao_visita r where r.request_id=p_request_id and (r.ator_id is distinct from v_actor or r.cliente_id is distinct from p_cliente_id or r.payload is distinct from v_payload)) then
    raise exception 'reserva_divergente' using errcode='42501';
  end if;
  if exists (select 1 from pcm.sso_criacao_visita_cancelamentos x where x.request_id=p_request_id) then
    raise exception 'criacao_visita_cancelada' using errcode='55000';
  end if;
  select * into v_comando from pcm.visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('visita.confirmar', v_comando.cliente_id) then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if p_responsavel_id is not null then
    perform 1 from pcm.funcionarios f where f.id = p_responsavel_id and f.ativo and f.deleted_at is null for share;
    if not found then raise exception 'responsavel_invalido' using errcode = '23514'; end if;
  end if;
  insert into pcm.visitas(id, cliente_id, contrato_id, area_id, local_id, inicio_em, fim_em, fuso, natureza,
    responsavel_id, deslocamento_minutos, created_by, updated_by)
    values (p_visita_id, p_cliente_id, p_contrato_id, p_area_id, p_local_id, p_inicio_em, p_fim_em, p_fuso,
      p_natureza, p_responsavel_id, p_deslocamento_minutos, v_actor, v_actor) returning * into v_visita;
  v_resultado := jsonb_build_object('aggregateId', v_visita.id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', true, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.rascunho_criado', 'visitas', p_visita_id, jsonb_build_object('requestId', p_request_id, 'depois', to_jsonb(v_visita)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;


