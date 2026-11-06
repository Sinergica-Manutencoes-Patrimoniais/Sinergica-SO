-- ADR-1237: leitura mínima de lotes para avaliação, com gates fechados.
create function pcm.sso_exigir_consulta_reversao_lote(p_ator_id uuid,p_cliente_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_reversao_lote_legado_gate where id and habilitado for share;
  if not found then raise exception 'reversao_lote_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_reversao_rascunho_legado_gate where id and habilitado for share;
  if not found then raise exception 'reversao_desabilitada' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_consulta_reversao_lote(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_lotes_rascunhos_legados(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(lote_id uuid,quantidade integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_exigir_consulta_reversao_lote(p_ator_id,p_cliente_id);
  return query select l.request_id,jsonb_array_length(l.itens),l.criado_em from pcm.sso_lotes_rascunhos_legados l
    where l.cliente_id=p_cliente_id and (p_apos is null or l.request_id>p_apos) order by l.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_lotes_rascunhos_legados(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_reversao_lote_legado(p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_lote pcm.sso_lotes_rascunhos_legados%rowtype;v_item jsonb;v_origem jsonb;v_itens jsonb:='[]'::jsonb;
begin
  if p_lote_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_exigir_consulta_reversao_lote(p_ator_id,p_cliente_id);
  select * into v_lote from pcm.sso_lotes_rascunhos_legados where request_id=p_lote_id and cliente_id=p_cliente_id;
  if not found or jsonb_typeof(v_lote.itens) is distinct from 'array' or jsonb_array_length(v_lote.itens) not between 1 and 20 then raise exception 'lote_indisponivel' using errcode='42501'; end if;
  for v_item in select e from jsonb_array_elements(v_lote.itens) e order by (e->>'planoId')::uuid loop
    v_origem:=pcm.sso_consultar_rascunho_plano_legado(p_ator_id,p_cliente_id,(v_item->>'planoId')::uuid);
    if v_origem->>'origemRequestId' is distinct from v_item->>'requestId' then raise exception 'origem_divergente' using errcode='23514'; end if;
    v_itens:=v_itens||jsonb_build_array(v_origem);
  end loop;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'loteId',p_lote_id,'itens',v_itens,'dependenciasComprovadas',false);
end; $$;
revoke all on function pcm.sso_consultar_reversao_lote_legado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_lotes_rascunhos_legados(uuid,uuid,uuid,integer),
  pcm.sso_consultar_reversao_lote_legado(uuid,uuid,uuid),
  pcm.sso_avaliar_reversao_lote_legado(uuid,uuid,uuid,uuid,jsonb,text) to authenticated;
