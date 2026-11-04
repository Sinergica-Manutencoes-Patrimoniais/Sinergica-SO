create table pcm.sso_contexto_reclassificacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_contexto_reclassificacao_gate(id,habilitado) values(true,false);
alter table pcm.sso_contexto_reclassificacao_gate enable row level security;alter table pcm.sso_contexto_reclassificacao_gate force row level security;
revoke all on pcm.sso_contexto_reclassificacao_gate from public,anon,authenticated,service_role;
create function pcm.sso_contexto_reclassificacao(p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_num bigint;v_versionadas bigint;v_validacao integer;v_proposta integer;v_decisao integer;v_ultima text;
begin
 if not coalesce((select habilitado from pcm.sso_contexto_reclassificacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_reclassificacao_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_decisao_proposta_resposta_gate where id),false) then raise exception 'contexto_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_retorno_id is null or p_resposta_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true or not exists(select 1 from pcm.respostas_os_preparadas p join pcm.retorno_os_preparado r on r.id=p.retorno_id where p.id=p_resposta_id and r.id=p_retorno_id and r.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*) into v_num from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_validacao from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 select d.decisao into v_ultima from pcm.sso_revisoes_validacao_os x join pcm.decisoes_validacao_os d on d.id=x.decisao_id and d.retorno_id=x.retorno_id where x.retorno_id=p_retorno_id and x.revisao=v_validacao;
 select coalesce(max(revisao),0) into v_proposta from pcm.sso_propostas_reclassificacao_resposta where resposta_id=p_resposta_id and retorno_id=p_retorno_id;
 select coalesce(max(revisao),0) into v_decisao from pcm.sso_decisoes_proposta_resposta where resposta_id=p_resposta_id and retorno_id=p_retorno_id;
 return jsonb_build_object('respostaId',p_resposta_id,'propostaRevision',v_proposta,'decisaoRevision',v_decisao,'validacaoRevision',v_validacao,'historicoReconciliado',v_num=v_versionadas,'ultimaValidacao',v_ultima,'jaAprovado',exists(select 1 from pcm.decisoes_validacao_os where retorno_id=p_retorno_id and decisao='aprovar'));
end; $$;
revoke all on function pcm.sso_contexto_reclassificacao(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_historico_reclassificacao(p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,tipo text,revisao integer,resultado text,observacao text,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_contexto jsonb;
begin
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_contexto:=pcm.sso_contexto_reclassificacao(p_cliente_id,p_retorno_id,p_resposta_id);
 return query select x.id,x.tipo,x.revisao,x.resultado,x.observacao,x.decisao,x.motivo,x.ator_id,x.criado_em from (
 select p.id,'proposta'::text tipo,p.revisao,p.resultado,p.observacao,null::text decisao,p.motivo,p.ator_id,p.criado_em from pcm.sso_propostas_reclassificacao_resposta p where p.retorno_id=p_retorno_id and p.resposta_id=p_resposta_id
 union all select d.id,'decisao'::text,d.revisao,null::text,null::text,d.decisao,d.motivo,d.ator_id,d.criado_em from pcm.sso_decisoes_proposta_resposta d where d.retorno_id=p_retorno_id and d.resposta_id=p_resposta_id
 ) x where p_apos is null or x.id>p_apos order by x.id limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_reclassificacao(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
