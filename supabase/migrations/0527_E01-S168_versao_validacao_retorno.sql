-- ADR-0301: ordenação explícita, sem encerramento de OS.
create table pcm.sso_revisao_validacao_os_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_revisao_validacao_os_gate enable row level security;
alter table pcm.sso_revisao_validacao_os_gate force row level security;
revoke all on pcm.sso_revisao_validacao_os_gate from public,anon,authenticated,service_role;
insert into pcm.sso_revisao_validacao_os_gate(id,habilitado) values(true,false);
create table pcm.sso_revisoes_validacao_os (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 decisao_id uuid not null unique references pcm.decisoes_validacao_os(id),revisao integer not null check(revisao>0),payload jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(retorno_id,revisao)
);
alter table pcm.sso_revisoes_validacao_os enable row level security;
alter table pcm.sso_revisoes_validacao_os force row level security;
revoke all on pcm.sso_revisoes_validacao_os from public,anon,authenticated,service_role;
create trigger sso_revisao_validacao_os_imutavel before update or delete on pcm.sso_revisoes_validacao_os for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_decidir_retorno_versionado(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_expected_revision integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_existente pcm.sso_revisoes_validacao_os%rowtype;v_payload jsonb;v_revisao integer;v_decisoes bigint;v_versionadas bigint;v_decisao_id uuid:=gen_random_uuid();v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) then raise exception 'validacao_os_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_expected_revision is null or p_expected_revision<0 or p_decisao is null or p_decisao not in ('aprovar','devolver','reabrir') or (p_decisao<>'aprovar' and nullif(btrim(p_motivo),'') is null) or (p_motivo is not null and length(p_motivo)>2000) then raise exception 'decisao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'expectedRevision',p_expected_revision,'decisao',p_decisao,'motivo',p_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_existente from pcm.sso_revisoes_validacao_os where request_id=p_request_id;
 if found then if v_existente.ator_id is distinct from v_actor or v_existente.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('retornoId',p_retorno_id,'decisaoId',v_existente.decisao_id,'revision',v_existente.revisao,'requestId',p_request_id); end if;
 select count(*) into v_decisoes from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_revisao from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 if v_decisoes<>v_versionadas then raise exception 'historico_nao_reconciliado' using errcode='23514'; end if;
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_validar_retorno_os_preparado(gen_random_uuid(),v_decisao_id,p_retorno_id,p_decisao,p_motivo);
 insert into pcm.sso_revisoes_validacao_os(request_id,retorno_id,decisao_id,revisao,payload,ator_id) values(p_request_id,p_retorno_id,v_decisao_id,v_revisao+1,v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.decisao_versionada','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'decisaoId',v_decisao_id,'revision',v_revisao+1));
 return jsonb_build_object('retornoId',p_retorno_id,'decisaoId',v_decisao_id,'revision',v_revisao+1,'requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_decidir_retorno_versionado(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_revisoes_validacao_os(p_cliente_id uuid,p_retorno_id uuid,p_antes integer,p_limite integer)
returns table(revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) then raise exception 'validacao_os_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select r.revisao,d.decisao,d.motivo,r.ator_id,r.criado_em from pcm.sso_revisoes_validacao_os r join pcm.decisoes_validacao_os d on d.id=r.decisao_id where r.retorno_id=p_retorno_id and (p_antes is null or r.revisao<p_antes) order by r.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_revisoes_validacao_os(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
