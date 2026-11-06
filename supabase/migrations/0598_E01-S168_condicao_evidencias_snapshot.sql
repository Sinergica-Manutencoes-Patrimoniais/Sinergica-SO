-- ADR-0372: condição auditada, sem promover cobertura ou aprovar OS.
create table pcm.sso_condicao_evidencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_condicao_evidencia_gate enable row level security;
alter table pcm.sso_condicao_evidencia_gate force row level security;
revoke all on pcm.sso_condicao_evidencia_gate from public,anon,authenticated,service_role;
insert into pcm.sso_condicao_evidencia_gate(id,habilitado) values(true,false);
create table pcm.sso_condicoes_evidencia_retorno (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 condicao_estrutural_id uuid not null unique references pcm.sso_condicoes_estruturais_retorno(id),revisao_evidencias integer not null,revisao_decisao integer not null,
 decisoes_resposta bigint not null,diagnostico jsonb not null,justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_condicoes_evidencia_retorno enable row level security;
alter table pcm.sso_condicoes_evidencia_retorno force row level security;
revoke all on pcm.sso_condicoes_evidencia_retorno from public,anon,authenticated,service_role;
create trigger sso_condicao_evidencia_retorno_imutavel before update or delete on pcm.sso_condicoes_evidencia_retorno for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_registrar_condicao_evidencias_retorno(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_condicoes_evidencia_retorno%rowtype;v_payload jsonb;v_condicao jsonb;v_diagnostico jsonb;v_decisoes bigint;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_condicao_evidencia_gate where id),false) then raise exception 'condicao_evidencia_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_conferencia_id is null or p_expected_evidencias is null or p_expected_evidencias<0 or p_expected_decisao is null or p_expected_decisao<0 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'condicao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'conferenciaId',p_conferencia_id,'expectedEvidencias',p_expected_evidencias,'expectedDecisao',p_expected_decisao,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_condicoes_evidencia_retorno where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('condicaoEvidenciaId',v_ant.id,'condicaoEstruturalId',v_ant.condicao_estrutural_id,'requestId',p_request_id,'aprovacaoDisponivel',false); end if;
 v_condicao:=pcm.sso_registrar_condicao_estrutural_retorno(gen_random_uuid(),p_cliente_id,p_retorno_id,p_conferencia_id,p_expected_evidencias,p_expected_decisao,btrim(p_justificativa));
 v_diagnostico:=pcm.sso_checar_evidencias_snapshot(p_cliente_id,p_retorno_id);
 if coalesce((v_diagnostico->>'requisitoIndeterminado')::integer,1)>0 or coalesce((v_diagnostico->>'semDecisaoPcmAceita')::integer,1)>0 then raise exception 'requisitos_evidencia_pendentes' using errcode='23514'; end if;
 select count(*) into v_decisoes from pcm.sso_validacoes_resposta where retorno_id=p_retorno_id;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_condicoes_evidencia_retorno(request_id,retorno_id,condicao_estrutural_id,revisao_evidencias,revisao_decisao,decisoes_resposta,diagnostico,justificativa,payload,ator_id)
 values(p_request_id,p_retorno_id,(v_condicao->>'condicaoId')::uuid,p_expected_evidencias,p_expected_decisao,v_decisoes,v_diagnostico,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.condicao_evidencias_registrada','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'condicaoEvidenciaId',v_id,'condicaoEstruturalId',v_condicao->>'condicaoId'));
 return jsonb_build_object('condicaoEvidenciaId',v_id,'condicaoEstruturalId',v_condicao->>'condicaoId','requestId',p_request_id,'aprovacaoDisponivel',false,'conteudoAutenticado',false);
end; $$;
revoke all on function pcm.sso_registrar_condicao_evidencias_retorno(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_condicoes_evidencia_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,condicao_estrutural_id uuid,revisao_evidencias integer,revisao_decisao integer,decisoes_resposta bigint,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_condicao_evidencia_gate where id),false) then raise exception 'condicao_evidencia_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select c.id,c.condicao_estrutural_id,c.revisao_evidencias,c.revisao_decisao,c.decisoes_resposta,c.justificativa,c.ator_id,c.criado_em from pcm.sso_condicoes_evidencia_retorno c where c.retorno_id=p_retorno_id and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_condicoes_evidencia_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
