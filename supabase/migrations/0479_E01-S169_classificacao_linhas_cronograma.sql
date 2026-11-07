-- ADR-0253: classificação explícita, sem aprovação ou alteração da matriz.
create table pcm.sso_cronograma_classificacoes_linha (
 id uuid primary key default gen_random_uuid(), lote_id uuid not null, chave_linha text not null,
 revisao_lote integer not null check(revisao_lote>1), tipo_linha text not null check(tipo_linha in ('cabecalho','dado','ignorada')),
 conferencia text not null check(conferencia in ('pendente','concluida')),
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),
 ator_id uuid not null references auth.users(id), criado_em timestamptz not null default now(),
 foreign key(lote_id,chave_linha) references pcm.sso_levantamento_linhas(lote_id,chave), unique(lote_id,revisao_lote)
);
create index sso_cronograma_classificacoes_linha_idx on pcm.sso_cronograma_classificacoes_linha(lote_id,chave_linha,revisao_lote desc);
alter table pcm.sso_cronograma_classificacoes_linha enable row level security;
alter table pcm.sso_cronograma_classificacoes_linha force row level security;
revoke all on pcm.sso_cronograma_classificacoes_linha from public,anon,authenticated,service_role;
create trigger sso_cronograma_classificacao_imutavel before update or delete on pcm.sso_cronograma_classificacoes_linha for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_classificar_linha_cronograma(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave_linha text,p_tipo text,p_conferencia text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_lote pcm.sso_levantamentos%rowtype; v_cmd pcm.sso_levantamento_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1
 or p_chave_linha is null or length(btrim(p_chave_linha)) not between 1 and 200 or p_tipo is null or p_tipo not in ('cabecalho','dado','ignorada')
 or p_conferencia is null or p_conferencia not in ('pendente','concluida') or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'classificacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','classificarLinhaCronograma','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chaveLinha',p_chave_linha,'tipoLinha',p_tipo,'conferencia',p_conferencia,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and origem='planilha' and chave_origem like 'cronograma:%' for update;
 if not found or config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then
   if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_cmd.resultado;
 end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave_linha and tipo='cronograma') then raise exception 'linha_inexistente' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_cronograma_classificacoes_linha(lote_id,chave_linha,revisao_lote,tipo_linha,conferencia,justificativa,ator_id)
 values(p_lote_id,p_chave_linha,v_lote.revisao,p_tipo,p_conferencia,btrim(p_justificativa),v_actor) returning id into v_id;
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','classificacaoId',v_id,'requestId',p_request_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.linha_classificada','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'classificacaoId',v_id,'revision',v_lote.revisao,'tipoLinha',p_tipo,'conferencia',p_conferencia));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_classificar_linha_cronograma(uuid,uuid,integer,text,text,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_classificacoes_cronograma(p_cliente_id uuid,p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(id uuid,revisao_lote integer,tipo_linha text,conferencia text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%') then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 return query select c.id,c.revisao_lote,c.tipo_linha,c.conferencia,c.justificativa,c.ator_id,c.criado_em from pcm.sso_cronograma_classificacoes_linha c where c.lote_id=p_lote_id and c.chave_linha=p_chave and (p_apos is null or c.revisao_lote>p_apos) order by c.revisao_lote limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_classificacoes_cronograma(uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;

create or replace function pcm.sso_diagnosticar_aprovacao_cronograma(p_cliente_id uuid,p_lote_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype; v_total integer; v_identificadas integer; v_mapeadas integer; v_rejeitadas integer; v_revisao integer; v_classificadas integer; v_cabecalhos integer; v_dados integer; v_ignoradas integer; v_concluidas integer;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%';
 if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 select count(*) into v_total from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.tipo='cronograma';
 select count(distinct i.chave_linha) into v_identificadas from pcm.sso_cronograma_identidades_linha i where i.lote_id=p_lote_id;
 select count(distinct m.chave_linha) into v_mapeadas from pcm.sso_cronograma_mapeamentos m where m.lote_id=p_lote_id;
 select count(*) filter(where x.estado='rejeitada'),count(*) filter(where x.estado='em_revisao') into v_rejeitadas,v_revisao from
  (select distinct on(r.chave_linha) r.chave_linha,r.estado from pcm.sso_cronograma_revisoes_linha r where r.lote_id=p_lote_id order by r.chave_linha,r.revisao_lote desc) x;
 select count(*),count(*) filter(where x.tipo_linha='cabecalho'),count(*) filter(where x.tipo_linha='dado'),count(*) filter(where x.tipo_linha='ignorada'),count(*) filter(where x.conferencia='concluida')
 into v_classificadas,v_cabecalhos,v_dados,v_ignoradas,v_concluidas from
  (select distinct on(c.chave_linha) c.chave_linha,c.tipo_linha,c.conferencia from pcm.sso_cronograma_classificacoes_linha c where c.lote_id=p_lote_id order by c.chave_linha,c.revisao_lote desc) x;
 return jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'linhasBrutas',v_total,'linhasClassificadas',v_classificadas,'cabecalhosDeclarados',v_cabecalhos,'dadosDeclarados',v_dados,'ignoradasDeclaradas',v_ignoradas,'conferenciasConcluidas',v_concluidas,
  'linhasComIdentidade',v_identificadas,'linhasComMapeamento',v_mapeadas,'linhasRejeitadas',v_rejeitadas,'linhasEmRevisao',v_revisao,'aprovacaoDisponivel',false,
  'impedimentos',jsonb_build_array('conferencia_e_mapeamento_por_linha_nao_comprovados','politica_e_autorizacao_de_aprovacao_nao_verificadas','incorporacao_e_idempotencia_operacional_nao_homologadas'));
end; $$;
revoke all on function pcm.sso_diagnosticar_aprovacao_cronograma(uuid,uuid) from public,anon,authenticated,service_role;
