-- ADR-0476: proposta auditável, sem alterar resposta efetiva ou aprovar retorno.
create table pcm.sso_reclassificacao_resposta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reclassificacao_resposta_gate(id,habilitado) values(true,false);
create table pcm.sso_propostas_reclassificacao_resposta(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),resposta_id uuid not null references pcm.respostas_os_preparadas(id),revisao integer not null check(revisao>0),revisao_validacao integer not null check(revisao_validacao>=0),resultado text not null check(resultado in ('ok','nao_ok','nao_aplicavel','nao_inspecionado','corrigido')),observacao text,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),unique(resposta_id,revisao),check(resultado<>'nao_aplicavel' or nullif(btrim(observacao),'') is not null));
alter table pcm.sso_reclassificacao_resposta_gate enable row level security;alter table pcm.sso_reclassificacao_resposta_gate force row level security;
alter table pcm.sso_propostas_reclassificacao_resposta enable row level security;alter table pcm.sso_propostas_reclassificacao_resposta force row level security;
revoke all on pcm.sso_reclassificacao_resposta_gate,pcm.sso_propostas_reclassificacao_resposta from public,anon,authenticated,service_role;
create trigger sso_propostas_reclassificacao_imutaveis before update or delete on pcm.sso_propostas_reclassificacao_resposta for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_propor_reclassificacao_resposta(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_expected_revision integer,p_expected_validacao integer,p_resultado text,p_observacao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_r pcm.retorno_os_preparado%rowtype;v_anterior pcm.sso_propostas_reclassificacao_resposta%rowtype;v_payload jsonb;v_rev integer;v_val integer;v_total bigint;v_versionadas bigint;v_ultima text;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_reclassificacao_resposta_gate where id),false) or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'reclassificacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_resposta_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_validacao is null or p_expected_validacao<0 or p_resultado is null or p_resultado not in ('ok','nao_ok','nao_aplicavel','nao_inspecionado','corrigido') or (p_observacao is not null and length(btrim(p_observacao))>4000) or (p_resultado='nao_aplicavel' and nullif(btrim(p_observacao),'') is null) or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'respostaId',p_resposta_id,'revision',p_expected_revision,'validacaoRevision',p_expected_validacao,'resultado',p_resultado,'observacao',nullif(btrim(p_observacao),''),'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reclassificacao-resposta:'||p_request_id::text,0));
 select * into v_r from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_anterior from pcm.sso_propostas_reclassificacao_resposta where request_id=p_request_id;
 if found then if v_anterior.ator_id is distinct from auth.uid() or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'respostaId',v_anterior.resposta_id,'revision',v_anterior.revisao,'efetivada',false); end if;
 if not exists(select 1 from pcm.respostas_os_preparadas where id=p_resposta_id and retorno_id=p_retorno_id) then raise exception 'resposta_indisponivel' using errcode='23514'; end if;
 select count(*) into v_total from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_val from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 if v_total<>v_versionadas then raise exception 'historico_nao_reconciliado' using errcode='23514'; end if;
 if v_val<>p_expected_validacao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if exists(select 1 from pcm.decisoes_validacao_os where retorno_id=p_retorno_id and decisao='aprovar') then
   select d.decisao into v_ultima from pcm.sso_revisoes_validacao_os x join pcm.decisoes_validacao_os d on d.id=x.decisao_id and d.retorno_id=x.retorno_id where x.retorno_id=p_retorno_id and x.revisao=v_val;
   if v_ultima is distinct from 'reabrir' then raise exception 'reabertura_explicita_obrigatoria' using errcode='23514'; end if;
 end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_propostas_reclassificacao_resposta where resposta_id=p_resposta_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 insert into pcm.sso_propostas_reclassificacao_resposta(request_id,retorno_id,resposta_id,revisao,revisao_validacao,resultado,observacao,motivo,ator_id,payload) values(p_request_id,p_retorno_id,p_resposta_id,v_rev+1,v_val,p_resultado,nullif(btrim(p_observacao),''),btrim(p_motivo),auth.uid(),v_payload);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'respostaId',p_resposta_id,'revision',v_rev+1,'efetivada',false);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'execucao.reclassificacao_proposta','retorno_os_preparado',p_retorno_id,v_payload||v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_propor_reclassificacao_resposta(uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
