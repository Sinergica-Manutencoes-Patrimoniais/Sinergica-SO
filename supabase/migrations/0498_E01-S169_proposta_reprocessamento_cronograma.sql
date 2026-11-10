-- ADR-0272: proposta imutável, sem editar a Rotina.
create table pcm.sso_cronograma_propostas_reprocessamento (
 id uuid primary key default gen_random_uuid(), cliente_id uuid not null references pcm.clientes(id),plano_id uuid not null references pcm.planos_manutencao(id),
 rotina_id uuid not null references pcm.rotinas_manutencao(id),versao_id uuid not null references pcm.plano_versoes(id),
 lote_id uuid not null,chave_linha text not null,aprovacao_id uuid not null references pcm.sso_cronograma_aprovacoes(id),
 revisao_lote integer not null,revisao_plano integer not null,antes jsonb not null,depois jsonb not null,
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
 foreign key(lote_id,chave_linha) references pcm.sso_levantamento_linhas(lote_id,chave)
);
alter table pcm.sso_cronograma_propostas_reprocessamento enable row level security;
alter table pcm.sso_cronograma_propostas_reprocessamento force row level security;
revoke all on pcm.sso_cronograma_propostas_reprocessamento from public,anon,authenticated,service_role;
create trigger sso_cronograma_proposta_imutavel before update or delete on pcm.sso_cronograma_propostas_reprocessamento for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_propor_reprocessamento_cronograma(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_lote_revision integer,p_chave text,p_plano_id uuid,p_expected_plano_revision integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_plano pcm.planos_manutencao%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;
 v_aprovacao pcm.sso_cronograma_aprovacoes%rowtype;v_classificacao pcm.sso_cronograma_classificacoes_linha%rowtype;v_identidade pcm.sso_cronograma_identidades_linha%rowtype;
 v_mapeamento pcm.sso_cronograma_mapeamentos%rowtype;v_estado pcm.sso_cronograma_revisoes_linha%rowtype;v_tolerancia pcm.sso_cronograma_tolerancias_mapeamento%rowtype;
 v_origem pcm.sso_cronograma_rotina_origem%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;v_payload jsonb;v_resultado jsonb;v_antes jsonb;v_depois jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_aprovacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_incorporacao_gate where id),false) then raise exception 'incorporacao_cronograma_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_lote_id is null or p_plano_id is null or p_expected_lote_revision is null or p_expected_lote_revision<1 or p_expected_plano_revision is null or p_expected_plano_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'proposta_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','proporReprocessamentoCronograma','clienteId',p_cliente_id,'loteId',p_lote_id,'expectedLoteRevision',p_expected_lote_revision,'chave',p_chave,'planoId',p_plano_id,'expectedPlanoRevision',p_expected_plano_revision,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%' for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_cmd.resultado; end if;
 if v_lote.revisao<>p_expected_lote_revision or v_plano.revisao<>p_expected_plano_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_plano.estado<>'rascunho' then raise exception 'plano_nao_editavel' using errcode='23514'; end if;
 select * into v_aprovacao from pcm.sso_cronograma_aprovacoes where lote_id=p_lote_id and revisao_aprovacao=v_lote.revisao;
 if not found then raise exception 'lote_sem_aprovacao_atual' using errcode='23514'; end if;
 select * into v_classificacao from pcm.sso_cronograma_classificacoes_linha where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_identidade from pcm.sso_cronograma_identidades_linha where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_mapeamento from pcm.sso_cronograma_mapeamentos where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_estado from pcm.sso_cronograma_revisoes_linha where lote_id=p_lote_id and chave_linha=p_chave order by revisao_lote desc limit 1;
 select * into v_tolerancia from pcm.sso_cronograma_tolerancias_mapeamento where lote_id=p_lote_id and chave_linha=p_chave and mapeamento_id=v_mapeamento.id order by revisao_lote desc limit 1;
 if v_classificacao.id is null or v_classificacao.tipo_linha<>'dado' or v_classificacao.conferencia<>'concluida' or v_identidade.id is null or v_mapeamento.id is null or v_estado.estado in ('em_revisao','rejeitada') or greatest(coalesce(v_identidade.revisao_lote,0),coalesce(v_mapeamento.revisao_lote,0),coalesce(v_estado.revisao_lote,0),coalesce(v_tolerancia.revisao_lote,0))>v_classificacao.revisao_lote then raise exception 'linha_nao_elegivel' using errcode='23514'; end if;
 select * into v_origem from pcm.sso_cronograma_rotina_origem o where o.cliente_id=p_cliente_id and o.plano_id=p_plano_id and o.identidade=v_identidade.identidade;
 if not found then raise exception 'identidade_nao_incorporada' using errcode='23514'; end if;
 select r.* into v_rotina from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id where r.id=v_origem.rotina_id and r.plano_id=p_plano_id and v.estado='rascunho' for share of r;
 if not found then raise exception 'rotina_nao_editavel' using errcode='23514'; end if;
 v_antes:=jsonb_build_object('nome',v_rotina.nome,'alvoTipo',v_rotina.alvo_tipo,'alvoId',coalesce(v_rotina.sistema_id,v_rotina.equipamento_id,v_rotina.grupo_id),'modo',v_rotina.modo,'intervalo',v_rotina.intervalo_n,'unidade',v_rotina.intervalo_unidade,'dataBase',v_rotina.data_base,'tempoMinutos',v_rotina.tempo_minutos,'toleranciaAntes',v_rotina.tolerancia_antes,'toleranciaDepois',v_rotina.tolerancia_depois);
 v_depois:=jsonb_build_object('nome',v_mapeamento.nome_rotina,'alvoTipo',v_mapeamento.alvo_tipo,'alvoId',v_mapeamento.alvo_id,'modo',v_mapeamento.modo,'intervalo',v_mapeamento.intervalo_n,'unidade',v_mapeamento.intervalo_unidade,'dataBase',v_mapeamento.data_base,'tempoMinutos',v_mapeamento.tempo_minutos,'toleranciaAntes',coalesce(v_tolerancia.antes,0),'toleranciaDepois',coalesce(v_tolerancia.depois,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_cronograma_propostas_reprocessamento(cliente_id,plano_id,rotina_id,versao_id,lote_id,chave_linha,aprovacao_id,revisao_lote,revisao_plano,antes,depois,justificativa,ator_id)
 values(p_cliente_id,p_plano_id,v_rotina.id,v_rotina.versao_id,p_lote_id,p_chave,v_aprovacao.id,v_lote.revisao,v_plano.revisao,v_antes,v_depois,btrim(p_justificativa),v_actor) returning id into v_id;
 v_resultado:=jsonb_build_object('propostaId',v_id,'state','pendente','loteRevision',v_lote.revisao,'planoRevision',v_plano.revisao,'requestId',p_request_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.reprocessamento_proposto','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'propostaId',v_id,'rotinaId',v_rotina.id));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado); return v_resultado;
end; $$;
revoke all on function pcm.sso_propor_reprocessamento_cronograma(uuid,uuid,uuid,integer,text,uuid,integer,text) from public,anon,authenticated,service_role;
