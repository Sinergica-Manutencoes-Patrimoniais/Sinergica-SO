-- ADR-0479: decisão de proposta e prévia; não efetiva classificação.
create table pcm.sso_decisao_proposta_resposta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_decisao_proposta_resposta_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_proposta_resposta(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,proposta_id uuid not null references pcm.sso_propostas_reclassificacao_resposta(id),resposta_id uuid not null references pcm.respostas_os_preparadas(id),retorno_id uuid not null references pcm.retorno_os_preparado(id),revisao integer not null check(revisao>0),revisao_validacao integer not null check(revisao_validacao>=0),decisao text not null check(decisao in ('aceita','rejeitada')),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),unique(resposta_id,revisao));
alter table pcm.sso_decisao_proposta_resposta_gate enable row level security;alter table pcm.sso_decisao_proposta_resposta_gate force row level security;
alter table pcm.sso_decisoes_proposta_resposta enable row level security;alter table pcm.sso_decisoes_proposta_resposta force row level security;
revoke all on pcm.sso_decisao_proposta_resposta_gate,pcm.sso_decisoes_proposta_resposta from public,anon,authenticated,service_role;
create trigger sso_decisoes_proposta_resposta_imutaveis before update or delete on pcm.sso_decisoes_proposta_resposta for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_decidir_proposta_resposta(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_proposta_id uuid,p_expected_decisao integer,p_expected_validacao integer,p_decisao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_r pcm.retorno_os_preparado%rowtype;v_p pcm.sso_propostas_reclassificacao_resposta%rowtype;v_ant pcm.sso_decisoes_proposta_resposta%rowtype;v_payload jsonb;v_rev integer;v_val integer;v_total bigint;v_versionadas bigint;v_ultima text;
begin
 if not coalesce((select habilitado from pcm.sso_decisao_proposta_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_reclassificacao_resposta_gate where id),false) or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'decisao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_proposta_id is null or p_expected_decisao is null or p_expected_decisao<0 or p_expected_validacao is null or p_expected_validacao<0 or p_decisao is null or p_decisao not in ('aceita','rejeitada') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'propostaId',p_proposta_id,'expectedDecisao',p_expected_decisao,'expectedValidacao',p_expected_validacao,'decisao',p_decisao,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-proposta:'||p_request_id::text,0));
 select * into v_r from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_decisoes_proposta_resposta where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'propostaId',p_proposta_id,'revision',v_ant.revisao,'decisao',v_ant.decisao,'efetivada',false); end if;
 select * into v_p from pcm.sso_propostas_reclassificacao_resposta where id=p_proposta_id and retorno_id=p_retorno_id;
 if not found or exists(select 1 from pcm.sso_propostas_reclassificacao_resposta x where x.resposta_id=v_p.resposta_id and x.revisao>v_p.revisao) then raise exception 'proposta_indisponivel_ou_obsoleta' using errcode='40001'; end if;
 select count(*) into v_total from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_val from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 if v_total<>v_versionadas then raise exception 'historico_nao_reconciliado' using errcode='23514'; end if;
 if v_val<>p_expected_validacao or v_val<>v_p.revisao_validacao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if exists(select 1 from pcm.decisoes_validacao_os where retorno_id=p_retorno_id and decisao='aprovar') then select d.decisao into v_ultima from pcm.sso_revisoes_validacao_os x join pcm.decisoes_validacao_os d on d.id=x.decisao_id and d.retorno_id=x.retorno_id where x.retorno_id=p_retorno_id and x.revisao=v_val; if v_ultima is distinct from 'reabrir' then raise exception 'reabertura_explicita_obrigatoria' using errcode='23514'; end if; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_decisoes_proposta_resposta where resposta_id=v_p.resposta_id;
 if v_rev<>p_expected_decisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 insert into pcm.sso_decisoes_proposta_resposta(request_id,proposta_id,resposta_id,retorno_id,revisao,revisao_validacao,decisao,motivo,ator_id,payload) values(p_request_id,p_proposta_id,v_p.resposta_id,p_retorno_id,v_rev+1,v_val,p_decisao,btrim(p_motivo),auth.uid(),v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'execucao.proposta_resposta_decidida','retorno_os_preparado',p_retorno_id,v_payload||jsonb_build_object('revision',v_rev+1,'requestId',p_request_id,'efetivada',false));
 return jsonb_build_object('requestId',p_request_id,'propostaId',p_proposta_id,'revision',v_rev+1,'decisao',p_decisao,'efetivada',false);
end; $$;
revoke all on function pcm.sso_decidir_proposta_resposta(uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_previa_resposta_reclassificada(p_cliente_id uuid,p_resposta_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_resp pcm.respostas_os_preparadas%rowtype;v_r pcm.retorno_os_preparado%rowtype;v_p pcm.sso_propostas_reclassificacao_resposta%rowtype;v_d pcm.sso_decisoes_proposta_resposta%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_decisao_proposta_resposta_gate where id),false) then raise exception 'previa_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_resposta_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_resp from pcm.respostas_os_preparadas where id=p_resposta_id;
 select * into v_r from pcm.retorno_os_preparado where id=v_resp.retorno_id and cliente_id=p_cliente_id;
 if v_r.id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_p from pcm.sso_propostas_reclassificacao_resposta where resposta_id=p_resposta_id and retorno_id=v_r.id order by revisao desc limit 1;
 if v_p.id is not null then select * into v_d from pcm.sso_decisoes_proposta_resposta where proposta_id=v_p.id and resposta_id=p_resposta_id order by revisao desc limit 1; end if;
 return jsonb_build_object('respostaId',v_resp.id,'original',jsonb_build_object('resultado',v_resp.resultado,'observacao',v_resp.observacao),'proposta',case when v_p.id is null then null else jsonb_build_object('id',v_p.id,'revisao',v_p.revisao,'resultado',v_p.resultado,'observacao',v_p.observacao,'decisao',v_d.decisao,'decisaoRevisao',v_d.revisao) end,'efetivada',false,'integracaoTransversalConcluida',false);
end; $$;
revoke all on function pcm.sso_previa_resposta_reclassificada(uuid,uuid) from public,anon,authenticated,service_role;
