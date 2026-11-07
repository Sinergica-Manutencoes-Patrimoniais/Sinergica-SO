-- ADR-0952: fundação privada; não retorna parcela ou altera fluxo legado.
create table pcm.sso_ciclos_backlog_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_ciclos_backlog_gate(id,habilitado) values(true,false);
create table pcm.sso_ciclos_backlog(
  id uuid primary key, pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),
  cliente_id uuid not null references pcm.clientes(id), composicao_id uuid not null references pcm.sso_backlog_composicoes(id),
  chamado_id uuid not null references pcm.chamados(id), parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),
  legado_pendencia_id uuid unique references pcm.sso_backlog_parcelas(pendencia_id),
  estado text not null check(estado in ('em_tratamento','devolvido','concluido')),
  revisao integer not null default 1 check(revisao>0), criado_em timestamptz not null default now(),
  unique(parcela_id)
);
create unique index sso_ciclos_backlog_um_ativo on pcm.sso_ciclos_backlog(pendencia_id) where estado='em_tratamento';
create table pcm.sso_ciclos_backlog_eventos(
  id uuid primary key default gen_random_uuid(),ciclo_id uuid not null references pcm.sso_ciclos_backlog(id),
  revisao integer not null check(revisao>0),tipo text not null check(tipo in ('legado_inicializado','devolvido','concluido')),
  ator_id uuid not null references auth.users(id),request_id uuid not null unique,payload jsonb not null,criado_em timestamptz not null default now(),
  unique(ciclo_id,revisao)
);
alter table pcm.sso_ciclos_backlog_gate enable row level security;alter table pcm.sso_ciclos_backlog_gate force row level security;
alter table pcm.sso_ciclos_backlog enable row level security;alter table pcm.sso_ciclos_backlog force row level security;
alter table pcm.sso_ciclos_backlog_eventos enable row level security;alter table pcm.sso_ciclos_backlog_eventos force row level security;
revoke all on pcm.sso_ciclos_backlog_gate,pcm.sso_ciclos_backlog,pcm.sso_ciclos_backlog_eventos from public,anon,authenticated,service_role;
create function pcm.sso_ciclos_backlog_eventos_imutaveis() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_ciclos_backlog_eventos_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_ciclos_backlog_eventos_imutaveis before update or delete on pcm.sso_ciclos_backlog_eventos
  for each row execute function pcm.sso_ciclos_backlog_eventos_imutaveis();

create function pcm.sso_inicializar_ciclo_backlog(p_request_id uuid,p_cliente_id uuid,p_pendencia_id uuid,p_ciclo_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_payload jsonb;v_composicao_id uuid;v_evento pcm.sso_ciclos_backlog_eventos%rowtype;
  v_link pcm.sso_backlog_parcelas%rowtype;v_c pcm.chamados%rowtype;v_p pcm.chamado_escopo_parcelas%rowtype;
begin
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_pendencia_id is null or p_ciclo_id is null then
    raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'pendenciaId',p_pendencia_id,'cicloId',p_ciclo_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciclo-backlog:'||p_request_id::text,0));
  select * into v_evento from pcm.sso_ciclos_backlog_eventos where request_id=p_request_id;
  if found then
    if v_evento.ator_id is distinct from v_ator or v_evento.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'cicloId',p_ciclo_id,'estadoInicial','em_tratamento','devolvido',false);
  end if;
  select * into v_link from pcm.sso_backlog_parcelas where pendencia_id=p_pendencia_id and cliente_id=p_cliente_id;
  if not found then raise exception 'vinculo_indisponivel' using errcode='42501'; end if;
  v_composicao_id:=v_link.composicao_id;
  select * into v_c from pcm.chamados where id=v_link.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  perform 1 from pcm.sso_backlog_composicoes where id=v_link.composicao_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'composicao_indisponivel' using errcode='23514'; end if;
  select * into v_link from pcm.sso_backlog_parcelas where pendencia_id=p_pendencia_id and cliente_id=p_cliente_id for update;
  select * into v_p from pcm.chamado_escopo_parcelas where id=v_link.parcela_id and chamado_id=v_c.id for update;
  if v_link.pendencia_id is null or v_link.composicao_id is distinct from v_composicao_id or v_link.chamado_id is distinct from v_c.id or v_p.id is null or v_p.situacao<>'pendente'
    or not exists(select 1 from pcm.sso_backlog_pendencias b join pcm.sso_pendencias_tecnicas p on p.id=b.pendencia_id
      where b.composicao_id=v_link.composicao_id and b.pendencia_id=p_pendencia_id and p.cliente_id=p_cliente_id) then
    raise exception 'vinculo_ou_parcela_incompativel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_ciclos_backlog(id,pendencia_id,cliente_id,composicao_id,chamado_id,parcela_id,legado_pendencia_id,estado)
    values(p_ciclo_id,p_pendencia_id,p_cliente_id,v_link.composicao_id,v_c.id,v_p.id,p_pendencia_id,'em_tratamento');
  insert into pcm.sso_ciclos_backlog_eventos(ciclo_id,revisao,tipo,ator_id,request_id,payload)
    values(p_ciclo_id,1,'legado_inicializado',v_ator,p_request_id,v_payload);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.ciclo_legado_inicializado','sso_ciclos_backlog',p_ciclo_id,v_payload||jsonb_build_object('requestId',p_request_id));
  return jsonb_build_object('requestId',p_request_id,'cicloId',p_ciclo_id,'estadoInicial','em_tratamento','devolvido',false);
end; $$;
revoke all on function pcm.sso_inicializar_ciclo_backlog(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
