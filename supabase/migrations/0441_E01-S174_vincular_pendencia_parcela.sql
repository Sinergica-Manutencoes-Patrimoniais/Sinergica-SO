-- ADR-0215: associação apenas, sem execução.
create table pcm.sso_backlog_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_backlog_parcela_gate(id,habilitado) values(true,false);
create table pcm.sso_backlog_parcelas(pendencia_id uuid primary key references pcm.sso_pendencias_tecnicas(id),parcela_id uuid not null unique references pcm.chamado_escopo_parcelas(id),
  composicao_id uuid not null references pcm.sso_backlog_composicoes(id),chamado_id uuid not null references pcm.chamados(id),cliente_id uuid not null references pcm.clientes(id),
  ator_id uuid not null references auth.users(id),request_id uuid not null unique,payload jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_backlog_parcela_gate enable row level security;
alter table pcm.sso_backlog_parcela_gate force row level security;
alter table pcm.sso_backlog_parcelas enable row level security;
alter table pcm.sso_backlog_parcelas force row level security;
revoke all on pcm.sso_backlog_parcela_gate,pcm.sso_backlog_parcelas from public,anon,authenticated,service_role;
create function pcm.sso_vincular_pendencia_parcela(p_request_id uuid,p_composicao_id uuid,p_composicao_revision integer,p_chamado_revision bigint,p_escopo_revision bigint,p_pendencia_id uuid,p_parcela_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_vinculo pcm.sso_backlog_chamado_vinculos%rowtype;v_chamado pcm.chamados%rowtype;v_backlog pcm.sso_backlog_composicoes%rowtype;
  v_escopo pcm.chamado_escopo_composicoes%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;v_pendencia pcm.sso_pendencias_tecnicas%rowtype;v_anterior pcm.sso_backlog_parcelas%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_backlog_parcela_gate where id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_composicao_id is null or p_composicao_revision is null or p_composicao_revision<1 or p_chamado_revision is null or p_chamado_revision<1 or p_escopo_revision is null or p_escopo_revision<1 or p_pendencia_id is null or p_parcela_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('composicaoId',p_composicao_id,'composicaoRevision',p_composicao_revision,'chamadoRevision',p_chamado_revision,'escopoRevision',p_escopo_revision,'pendenciaId',p_pendencia_id,'parcelaId',p_parcela_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('backlog-parcela:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_backlog_parcelas where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or config.sso_autorizar_acao('execucao.validar',v_anterior.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_anterior.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('pendenciaId',p_pendencia_id,'parcelaId',p_parcela_id,'requestId',p_request_id,'atendida',false);
  end if;
  select * into v_vinculo from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id;
  if not found then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  select * into v_chamado from pcm.chamados where id=v_vinculo.chamado_id for update;
  select * into v_backlog from pcm.sso_backlog_composicoes where id=p_composicao_id for update;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=v_vinculo.chamado_id for update;
  if v_chamado.id is null or v_backlog.id is null or v_escopo.chamado_id is null or v_chamado.deleted_at is not null or v_chamado.cliente_id is distinct from v_vinculo.cliente_id or v_backlog.cliente_id is distinct from v_vinculo.cliente_id
    or config.sso_autorizar_acao('execucao.validar',v_vinculo.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_vinculo.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_chamado.sso_revisao<>p_chamado_revision or v_backlog.revisao<>p_composicao_revision or v_escopo.revisao<>p_escopo_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado.id for update;
  select * into v_pendencia from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
  if v_parcela.id is null or v_pendencia.id is null or v_parcela.situacao<>'pendente' or v_pendencia.estado<>'aberta' or v_pendencia.cliente_id is distinct from v_vinculo.cliente_id
    or not exists(select 1 from pcm.sso_backlog_pendencias b where b.composicao_id=p_composicao_id and b.pendencia_id=p_pendencia_id and b.revisao_origem=v_pendencia.revisao) then raise exception 'escopo_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',v_vinculo.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_vinculo.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_backlog_parcelas(pendencia_id,parcela_id,composicao_id,chamado_id,cliente_id,ator_id,request_id,payload) values(p_pendencia_id,p_parcela_id,p_composicao_id,v_chamado.id,v_vinculo.cliente_id,v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('pendenciaId',p_pendencia_id,'parcelaId',p_parcela_id,'requestId',p_request_id,'atendida',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.pendencia_vinculada_parcela','sso_backlog_composicoes',p_composicao_id,v_resultado||jsonb_build_object('clienteId',v_vinculo.cliente_id,'chamadoId',v_chamado.id));return v_resultado;
end;
$$;
revoke all on function pcm.sso_vincular_pendencia_parcela(uuid,uuid,integer,bigint,bigint,uuid,uuid) from public,anon,authenticated,service_role;
