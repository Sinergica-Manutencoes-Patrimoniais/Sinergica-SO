-- ADR-0980: mediadores privados da reconciliação existente, sem alteração do vínculo legado.
create function pcm.sso_conferir_contexto_ciclo_reconciliacao(p_cliente_id uuid,p_ciclo_id uuid,p_parcela_id uuid,p_exige_ativo boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo pcm.sso_ciclos_backlog%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.sso_reconciliacao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'reconciliacao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_ciclo_id is null or p_parcela_id is null or p_exige_ativo is null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id and legado_pendencia_id is null;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id for update;
  if v_ciclo.id is null or v_ciclo.legado_pendencia_id is not null or (p_exige_ativo and v_ciclo.estado<>'em_tratamento')
    or pcm.sso_ciclo_promocao_valida(p_cliente_id,v_ciclo.id,v_ciclo.chamado_id,p_parcela_id) is distinct from true
    then raise exception 'ciclo_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_conferir_contexto_ciclo_reconciliacao(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_reconciliacao_ciclo(p_cliente_id uuid,p_ciclo_id uuid,p_parcela_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_conferir_contexto_ciclo_reconciliacao(p_cliente_id,p_ciclo_id,p_parcela_id,false);
  return pcm.sso_consultar_reconciliacao_parcela(p_parcela_id);
end; $$;
revoke all on function pcm.sso_consultar_reconciliacao_ciclo(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_reconciliacoes_ciclo(p_cliente_id uuid,p_ciclo_id uuid,p_parcela_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,os_id uuid,evidencia_id uuid,estado text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_conferir_contexto_ciclo_reconciliacao(p_cliente_id,p_ciclo_id,p_parcela_id,false);
  return query select * from pcm.sso_listar_reconciliacoes_parcela(p_parcela_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_reconciliacoes_ciclo(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_evidencias_ciclo(p_cliente_id uuid,p_ciclo_id uuid,p_parcela_id uuid,p_apos uuid,p_limite integer)
returns table(evidencia_id uuid,os_id uuid,tipo text,referencia text,descricao text)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_conferir_contexto_ciclo_reconciliacao(p_cliente_id,p_ciclo_id,p_parcela_id,false);
  return query select * from pcm.sso_listar_evidencias_revisao_parcela(p_parcela_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_evidencias_ciclo(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_reconciliar_parcela_ciclo(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,
  p_parcela_id uuid,p_os_id uuid,p_evidencia_id uuid,p_expected_revision integer,p_suspensao_revision integer,p_interrupcao_revision integer,
  p_estado text,p_confirma boolean,p_motivo text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_repeticao boolean;
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado or p_request_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-parcela:'||p_request_id::text,0));
  select exists(select 1 from pcm.sso_reconciliacoes_parcela where request_id=p_request_id) into v_repeticao;
  perform pcm.sso_conferir_contexto_ciclo_reconciliacao(p_cliente_id,p_ciclo_id,p_parcela_id,not v_repeticao);
  return pcm.sso_reconciliar_parcela_humana(p_request_id,p_parcela_id,p_os_id,p_evidencia_id,p_expected_revision,p_suspensao_revision,p_interrupcao_revision,p_estado,p_confirma,p_motivo);
end; $$;
revoke all on function pcm.sso_reconciliar_parcela_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text) from public,anon,authenticated,service_role;
