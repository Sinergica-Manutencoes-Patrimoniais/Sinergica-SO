-- ADR-0268: criação canônica de uma Rotina rascunho, sem execução operacional.
create table pcm.sso_cronograma_incorporacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_cronograma_incorporacao_gate enable row level security;
alter table pcm.sso_cronograma_incorporacao_gate force row level security;
revoke all on pcm.sso_cronograma_incorporacao_gate from public,anon,authenticated,service_role;
insert into pcm.sso_cronograma_incorporacao_gate(id,habilitado) values(true,false);

create function pcm.sso_incorporar_linha_cronograma(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_lote_revision integer,p_chave text,p_plano_id uuid,p_expected_plano_revision integer,p_rotina_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_plano pcm.planos_manutencao%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;
 v_aprovacao pcm.sso_cronograma_aprovacoes%rowtype;v_classificacao pcm.sso_cronograma_classificacoes_linha%rowtype;
 v_identidade pcm.sso_cronograma_identidades_linha%rowtype;v_mapeamento pcm.sso_cronograma_mapeamentos%rowtype;
 v_estado pcm.sso_cronograma_revisoes_linha%rowtype;v_tolerancia pcm.sso_cronograma_tolerancias_mapeamento%rowtype;
 v_payload jsonb;v_resultado jsonb;v_criacao jsonb;v_origem uuid;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_aprovacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_incorporacao_gate where id),false) then raise exception 'incorporacao_cronograma_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_lote_id is null or p_plano_id is null or p_rotina_id is null or p_expected_lote_revision is null or p_expected_lote_revision<1 or p_expected_plano_revision is null or p_expected_plano_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'incorporacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','incorporarLinhaCronograma','clienteId',p_cliente_id,'loteId',p_lote_id,'expectedLoteRevision',p_expected_lote_revision,'chave',p_chave,'planoId',p_plano_id,'expectedPlanoRevision',p_expected_plano_revision,'rotinaId',p_rotina_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%' for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then
  if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_cmd.resultado;
 end if;
 if v_lote.revisao<>p_expected_lote_revision or v_plano.revisao<>p_expected_plano_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_plano.estado<>'rascunho' then raise exception 'plano_nao_editavel' using errcode='23514'; end if;
 select * into v_aprovacao from pcm.sso_cronograma_aprovacoes a where a.lote_id=p_lote_id and a.revisao_aprovacao=v_lote.revisao;
 if not found then raise exception 'lote_sem_aprovacao_atual' using errcode='23514'; end if;
 select * into v_classificacao from pcm.sso_cronograma_classificacoes_linha where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_identidade from pcm.sso_cronograma_identidades_linha where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_mapeamento from pcm.sso_cronograma_mapeamentos where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_estado from pcm.sso_cronograma_revisoes_linha where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_tolerancia from pcm.sso_cronograma_tolerancias_mapeamento where lote_id=p_lote_id and chave_linha=p_chave and mapeamento_id=v_mapeamento.id order by revisao_lote desc limit 1;
 if v_classificacao.id is null or v_classificacao.tipo_linha<>'dado' or v_classificacao.conferencia<>'concluida' or v_identidade.id is null or v_mapeamento.id is null or v_estado.estado in ('em_revisao','rejeitada') or greatest(coalesce(v_identidade.revisao_lote,0),coalesce(v_mapeamento.revisao_lote,0),coalesce(v_estado.revisao_lote,0),coalesce(v_tolerancia.revisao_lote,0))>v_classificacao.revisao_lote then raise exception 'linha_nao_elegivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_cronograma_rotina_origem o where o.cliente_id=p_cliente_id and o.plano_id=p_plano_id and o.identidade=v_identidade.identidade) then raise exception 'identidade_ja_incorporada' using errcode='23505'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_criacao:=pcm.sso_adicionar_rotina_rascunho_v2(gen_random_uuid(),p_expected_plano_revision,p_plano_id,p_rotina_id,v_mapeamento.nome_rotina,v_mapeamento.alvo_tipo,v_mapeamento.alvo_id,v_mapeamento.modo,v_mapeamento.intervalo_n,v_mapeamento.intervalo_unidade,v_mapeamento.data_base,v_mapeamento.tempo_minutos,coalesce(v_tolerancia.antes,0),coalesce(v_tolerancia.depois,0),null,null,null);
 insert into pcm.sso_cronograma_rotina_origem(cliente_id,plano_id,identidade,rotina_id,lote_id,chave_linha,aprovacao_id,ator_id) values(p_cliente_id,p_plano_id,v_identidade.identidade,p_rotina_id,p_lote_id,p_chave,v_aprovacao.id,v_actor) returning id into v_origem;
 v_resultado:=jsonb_build_object('aggregateId',p_plano_id,'revision',v_criacao->'revision','state','rascunho','rotinaId',p_rotina_id,'origemId',v_origem,'aprovacaoId',v_aprovacao.id,'requestId',p_request_id,'warnings',v_criacao->'warnings');
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.linha_incorporada_rascunho','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'origemId',v_origem,'rotinaId',p_rotina_id,'aprovacaoId',v_aprovacao.id));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado); return v_resultado;
end; $$;
revoke all on function pcm.sso_incorporar_linha_cronograma(uuid,uuid,uuid,integer,text,uuid,integer,uuid) from public,anon,authenticated,service_role;
