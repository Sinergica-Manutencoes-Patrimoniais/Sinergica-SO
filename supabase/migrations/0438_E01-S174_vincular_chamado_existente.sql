-- ADR-0212: sem criar Chamado, parcela, OS ou integração.
create table pcm.sso_backlog_chamado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_backlog_chamado_gate(id,habilitado) values(true,false);
create table pcm.sso_backlog_chamado_vinculos(composicao_id uuid primary key references pcm.sso_backlog_composicoes(id),
  chamado_id uuid not null references pcm.chamados(id),cliente_id uuid not null references pcm.clientes(id),
  revisao_composicao integer not null,revisao_chamado bigint not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now());
alter table pcm.sso_backlog_chamado_gate enable row level security;
alter table pcm.sso_backlog_chamado_gate force row level security;
alter table pcm.sso_backlog_chamado_vinculos enable row level security;
alter table pcm.sso_backlog_chamado_vinculos force row level security;
revoke all on pcm.sso_backlog_chamado_gate,pcm.sso_backlog_chamado_vinculos from public,anon,authenticated,service_role;
create function pcm.sso_vincular_backlog_chamado(p_request_id uuid,p_composicao_id uuid,p_composicao_revision integer,p_chamado_id uuid,p_chamado_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_backlog pcm.sso_backlog_composicoes%rowtype;v_chamado pcm.chamados%rowtype;
  v_anterior pcm.sso_backlog_chamado_vinculos%rowtype;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_backlog_chamado_gate where id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_composicao_id is null or p_composicao_revision is null or p_composicao_revision<1 or p_chamado_id is null or p_chamado_revision is null or p_chamado_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('backlog-chamado:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_backlog_chamado_vinculos where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or config.sso_autorizar_acao('execucao.validar',v_anterior.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_anterior.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_anterior.composicao_id is distinct from p_composicao_id or v_anterior.chamado_id is distinct from p_chamado_id or v_anterior.revisao_composicao<>p_composicao_revision or v_anterior.revisao_chamado<>p_chamado_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('composicaoId',p_composicao_id,'chamadoId',p_chamado_id,'requestId',p_request_id,'osCriada',false);
  end if;
  select * into v_chamado from pcm.chamados where id=p_chamado_id for update;
  select * into v_backlog from pcm.sso_backlog_composicoes where id=p_composicao_id for update;
  if v_chamado.id is null or v_backlog.id is null or v_chamado.deleted_at is not null or v_chamado.cliente_id is distinct from v_backlog.cliente_id
    or config.sso_autorizar_acao('execucao.validar',v_backlog.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_backlog.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_chamado.sso_revisao<>p_chamado_revision or v_backlog.revisao<>p_composicao_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_chamado.status not in ('aberto','convertido_os') or exists(select 1 from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id) then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  perform 1 from pcm.sso_pendencias_tecnicas p join pcm.sso_backlog_pendencias b on b.pendencia_id=p.id where b.composicao_id=p_composicao_id order by p.id for update of p;
  if not found or exists(select 1 from pcm.sso_backlog_pendencias b join pcm.sso_pendencias_tecnicas p on p.id=b.pendencia_id
    where b.composicao_id=p_composicao_id and (p.cliente_id is distinct from v_backlog.cliente_id or p.alvo_tipo is distinct from v_backlog.alvo_tipo or p.alvo_id is distinct from v_backlog.alvo_id or p.estado<>'aberta' or p.revisao<>b.revisao_origem)) then raise exception 'escopo_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',v_backlog.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_backlog.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_backlog_chamado_vinculos(composicao_id,chamado_id,cliente_id,revisao_composicao,revisao_chamado,ator_id,request_id)
    values(p_composicao_id,p_chamado_id,v_backlog.cliente_id,p_composicao_revision,p_chamado_revision,v_ator,p_request_id);
  v_resultado:=jsonb_build_object('composicaoId',p_composicao_id,'chamadoId',p_chamado_id,'requestId',p_request_id,'osCriada',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.vinculado_chamado','sso_backlog_composicoes',p_composicao_id,v_resultado||jsonb_build_object('clienteId',v_backlog.cliente_id));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_vincular_backlog_chamado(uuid,uuid,integer,uuid,bigint) from public,anon,authenticated,service_role;
