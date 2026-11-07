-- ADR-0375: atestação humana explícita; sem encerramento de OS.
create table pcm.sso_atestacao_pcm_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_atestacao_pcm_gate enable row level security;
alter table pcm.sso_atestacao_pcm_gate force row level security;
revoke all on pcm.sso_atestacao_pcm_gate from public,anon,authenticated,service_role;
insert into pcm.sso_atestacao_pcm_gate(id,habilitado) values(true,false);
create table pcm.sso_token_aprovacao_retorno(txid bigint not null,retorno_id uuid not null,primary key(txid,retorno_id));
alter table pcm.sso_token_aprovacao_retorno enable row level security;
alter table pcm.sso_token_aprovacao_retorno force row level security;
revoke all on pcm.sso_token_aprovacao_retorno from public,anon,authenticated,service_role;
create function pcm.sso_guardar_token_atestacao_retorno() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.decisao='aprovar' and coalesce((select habilitado from pcm.sso_atestacao_pcm_gate where id),false)
 and exists(select 1 from pcm.retorno_os_preparado where id=new.retorno_id and origem='manual_declarado')
 and not exists(select 1 from pcm.sso_token_aprovacao_retorno where txid=pg_catalog.txid_current() and retorno_id=new.retorno_id) then raise exception 'atestacao_pcm_obrigatoria' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_token_atestacao_retorno() from public,anon,authenticated,service_role;
create trigger sso_guardar_token_atestacao_retorno before insert on pcm.decisoes_validacao_os for each row execute function pcm.sso_guardar_token_atestacao_retorno();
create table pcm.sso_atestacoes_pcm_retorno (
 request_id uuid primary key,retorno_id uuid not null references pcm.retorno_os_preparado(id),condicao_evidencia_id uuid not null references pcm.sso_condicoes_evidencia_retorno(id),
 decisao_id uuid not null unique references pcm.decisoes_validacao_os(id),revisao_decisao integer not null,justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),
 payload jsonb not null,resultado jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_atestacoes_pcm_retorno enable row level security;
alter table pcm.sso_atestacoes_pcm_retorno force row level security;
revoke all on pcm.sso_atestacoes_pcm_retorno from public,anon,authenticated,service_role;
create trigger sso_atestacao_pcm_retorno_imutavel before update or delete on pcm.sso_atestacoes_pcm_retorno for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_atestar_aprovar_retorno_pcm(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_atestacoes_pcm_retorno%rowtype;v_payload jsonb;v_condicao jsonb;v_decisao jsonb;v_pendencias jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_atestacao_pcm_gate where id),false) then raise exception 'atestacao_pcm_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_conferencia_id is null or p_expected_evidencias is null or p_expected_evidencias<0 or p_expected_decisao is null or p_expected_decisao<0 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'atestacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'conferenciaId',p_conferencia_id,'expectedEvidencias',p_expected_evidencias,'expectedDecisao',p_expected_decisao,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id and origem='manual_declarado' for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_atestacoes_pcm_retorno where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 v_condicao:=pcm.sso_registrar_condicao_evidencias_retorno(gen_random_uuid(),p_cliente_id,p_retorno_id,p_conferencia_id,p_expected_evidencias,p_expected_decisao,btrim(p_justificativa));
 insert into pcm.sso_token_aprovacao_retorno(txid,retorno_id) values(pg_catalog.txid_current(),p_retorno_id);
 update pcm.retorno_os_preparado set cobertura_comprovada=true where id=p_retorno_id;
 v_decisao:=pcm.sso_decidir_retorno_versionado(gen_random_uuid(),p_cliente_id,p_retorno_id,p_expected_decisao,'aprovar',btrim(p_justificativa));
 update pcm.retorno_os_preparado set cobertura_comprovada=v_retorno.cobertura_comprovada where id=p_retorno_id;
 delete from pcm.sso_token_aprovacao_retorno where txid=pg_catalog.txid_current() and retorno_id=p_retorno_id;
 v_pendencias:=pcm.sso_preparar_pendencias_retorno_aprovado(gen_random_uuid(),p_cliente_id,p_retorno_id,(v_condicao->>'condicaoEstruturalId')::uuid,(v_decisao->>'revision')::integer);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('retornoId',p_retorno_id,'condicaoEvidenciaId',v_condicao->>'condicaoEvidenciaId','decisaoId',v_decisao->>'decisaoId','revision',v_decisao->'revision','pendenciasProcessadas',v_pendencias->'pendenciasProcessadas','osEncerrada',false,'conteudoAutenticado',false,'requestId',p_request_id);
 insert into pcm.sso_atestacoes_pcm_retorno(request_id,retorno_id,condicao_evidencia_id,decisao_id,revisao_decisao,justificativa,payload,resultado,ator_id)
 values(p_request_id,p_retorno_id,(v_condicao->>'condicaoEvidenciaId')::uuid,(v_decisao->>'decisaoId')::uuid,(v_decisao->>'revision')::integer,btrim(p_justificativa),v_payload,v_resultado,v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.retorno_atestado_pcm','retorno_os_preparado',p_retorno_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_atestar_aprovar_retorno_pcm(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_atestacoes_pcm_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,condicao_evidencia_id uuid,decisao_id uuid,revisao_decisao integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_atestacao_pcm_gate where id),false) then raise exception 'atestacao_pcm_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select a.request_id,a.condicao_evidencia_id,a.decisao_id,a.revisao_decisao,a.justificativa,a.ator_id,a.criado_em from pcm.sso_atestacoes_pcm_retorno a where a.retorno_id=p_retorno_id and (p_apos is null or a.request_id>p_apos) order by a.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_atestacoes_pcm_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
