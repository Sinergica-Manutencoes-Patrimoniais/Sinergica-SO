-- ADR-0363: wrapper privado, nunca promove cobertura ou encerra OS.
create table pcm.sso_aprovacao_retorno_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_aprovacao_retorno_gate enable row level security;
alter table pcm.sso_aprovacao_retorno_gate force row level security;
revoke all on pcm.sso_aprovacao_retorno_gate from public,anon,authenticated,service_role;
insert into pcm.sso_aprovacao_retorno_gate(id,habilitado) values(true,false);
create table pcm.sso_aprovacoes_retorno_estruturais (
 request_id uuid primary key,retorno_id uuid not null references pcm.retorno_os_preparado(id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_aprovacoes_retorno_estruturais enable row level security;
alter table pcm.sso_aprovacoes_retorno_estruturais force row level security;
revoke all on pcm.sso_aprovacoes_retorno_estruturais from public,anon,authenticated,service_role;
create trigger sso_aprovacao_retorno_estrutural_imutavel before update or delete on pcm.sso_aprovacoes_retorno_estruturais for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_aprovar_retorno_estrutural(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_aprovacoes_retorno_estruturais%rowtype;v_payload jsonb;v_condicao jsonb;v_decisao jsonb;v_pendencias jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_aprovacao_retorno_gate where id),false) then raise exception 'aprovacao_retorno_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_conferencia_id is null or p_expected_evidencias is null or p_expected_evidencias<0 or p_expected_decisao is null or p_expected_decisao<0 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'aprovacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'conferenciaId',p_conferencia_id,'expectedEvidencias',p_expected_evidencias,'expectedDecisao',p_expected_decisao,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_aprovacoes_retorno_estruturais where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 if v_retorno.cobertura_comprovada is distinct from true then raise exception 'cobertura_nao_comprovada' using errcode='23514'; end if;
 v_condicao:=pcm.sso_registrar_condicao_estrutural_retorno(gen_random_uuid(),p_cliente_id,p_retorno_id,p_conferencia_id,p_expected_evidencias,p_expected_decisao,btrim(p_justificativa));
 v_decisao:=pcm.sso_decidir_retorno_versionado(gen_random_uuid(),p_cliente_id,p_retorno_id,p_expected_decisao,'aprovar',btrim(p_justificativa));
 v_pendencias:=pcm.sso_preparar_pendencias_retorno_aprovado(gen_random_uuid(),p_cliente_id,p_retorno_id,(v_condicao->>'condicaoId')::uuid,(v_decisao->>'revision')::integer);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('retornoId',p_retorno_id,'condicaoId',v_condicao->>'condicaoId','decisaoId',v_decisao->>'decisaoId','revision',v_decisao->'revision','pendenciasProcessadas',v_pendencias->'pendenciasProcessadas','osEncerrada',false,'requestId',p_request_id);
 insert into pcm.sso_aprovacoes_retorno_estruturais(request_id,retorno_id,ator_id,payload,resultado) values(p_request_id,p_retorno_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.retorno_aprovacao_preparada','retorno_os_preparado',p_retorno_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_aprovar_retorno_estrutural(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
