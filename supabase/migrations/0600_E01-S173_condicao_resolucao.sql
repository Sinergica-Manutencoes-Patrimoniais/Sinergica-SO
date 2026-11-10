-- ADR-0374: resolução exige contexto revisado; nenhuma execução concedida.
create table pcm.sso_resolucao_condicao_pendencia(pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),resolucao_revision integer not null,contexto_revision integer not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),primary key(pendencia_id,resolucao_revision),foreign key(pendencia_id,contexto_revision) references pcm.sso_contexto_pendencia(pendencia_id,revisao));
alter table pcm.sso_resolucao_condicao_pendencia enable row level security;alter table pcm.sso_resolucao_condicao_pendencia force row level security;
revoke all on pcm.sso_resolucao_condicao_pendencia from public,anon,authenticated,service_role;
create function pcm.sso_resolucao_condicao_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_resolucao_condicao_imutavel() from public,anon,authenticated,service_role;
create trigger sso_resolucao_condicao_imutavel before update or delete on pcm.sso_resolucao_condicao_pendencia for each row execute function pcm.sso_resolucao_condicao_imutavel();
alter function pcm.sso_resolver_pendencia_humana(uuid,uuid,integer,uuid,boolean,text,text) rename to sso_resolver_pendencia_humana_interno;
revoke all on function pcm.sso_resolver_pendencia_humana_interno(uuid,uuid,integer,uuid,boolean,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_resolver_pendencia_humana(p_request_id uuid,p_pendencia_id uuid,p_revision integer,p_evidencia_id uuid,p_atesta_condicao boolean,p_atestacao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'revisao_condicao_obrigatoria' using errcode='55000'; end;
$$;
revoke all on function pcm.sso_resolver_pendencia_humana(uuid,uuid,integer,uuid,boolean,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_resolver_pendencia_humana_v2(p_request_id uuid,p_pendencia_id uuid,p_revision integer,p_evidencia_id uuid,p_contexto_revision integer,p_atesta_condicao boolean,p_atestacao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_p pcm.sso_pendencias_tecnicas%rowtype;v_contexto pcm.sso_contexto_pendencia%rowtype;v_ant pcm.sso_resolucao_condicao_pendencia%rowtype;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_resolucao_pendencia_gate where id),false) or not coalesce((select habilitado from pcm.sso_pendencias_gate where id),false) then raise exception 'resolucao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_pendencia_id is null or p_revision is null or p_revision<1 or p_contexto_revision is null or p_contexto_revision<1 or p_atesta_condicao is not true then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pendencias:'||p_request_id::text,0));
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_resolucao_condicao_pendencia where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.pendencia_id is distinct from p_pendencia_id or v_ant.resolucao_revision<>p_revision+1 or v_ant.contexto_revision<>p_contexto_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return pcm.sso_resolver_pendencia_humana_interno(p_request_id,p_pendencia_id,p_revision,p_evidencia_id,p_atesta_condicao,p_atestacao,p_motivo);
  end if;
  if v_p.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_contexto from pcm.sso_contexto_pendencia where pendencia_id=p_pendencia_id order by revisao desc limit 1;
  if not found or v_contexto.revisao<>p_contexto_revision or v_contexto.condicao is null then raise exception 'condicao_indisponivel_ou_obsoleta' using errcode='40001'; end if;
  v_resultado:=pcm.sso_resolver_pendencia_humana_interno(p_request_id,p_pendencia_id,p_revision,p_evidencia_id,p_atesta_condicao,p_atestacao,p_motivo);
  insert into pcm.sso_resolucao_condicao_pendencia(pendencia_id,resolucao_revision,contexto_revision,ator_id,request_id) values(p_pendencia_id,p_revision+1,p_contexto_revision,v_ator,p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'pendencia.condicao_resolucao','pendencia_tecnica',p_pendencia_id,jsonb_build_object('clienteId',v_p.cliente_id,'revision',p_revision+1,'contextoRevision',p_contexto_revision,'requestId',p_request_id));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_resolver_pendencia_humana_v2(uuid,uuid,integer,uuid,integer,boolean,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_condicao_resolucao(p_pendencia_id uuid,p_revision integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;v_contexto pcm.sso_contexto_pendencia%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_resolucao_pendencia_gate where id),false) then raise exception 'resolucao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_pendencia_id is null or p_revision is null or p_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_p.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_contexto from pcm.sso_contexto_pendencia where pendencia_id=p_pendencia_id order by revisao desc limit 1;
  return jsonb_build_object('pendenciaId',p_pendencia_id,'revision',v_p.revisao,'contextoRevision',v_contexto.revisao,'condicao',v_contexto.condicao);
end;
$$;
revoke all on function pcm.sso_consultar_condicao_resolucao(uuid,integer) from public,anon,authenticated,service_role;
