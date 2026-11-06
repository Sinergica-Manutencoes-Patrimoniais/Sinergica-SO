-- ADR-0957: consulta privada, não devolve bytes ou conteúdo de outras tentativas.
create function pcm.sso_recuperar_estrutura_xlsx(p_cliente uuid,p_origem text,p_aba text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_rec pcm.sso_estrutura_xlsx_recibos%rowtype;v_total bigint;v_id text;
begin
  perform 1 from pcm.sso_estrutura_xlsx_gate where id and habilitado for share;
  if not found then raise exception 'estrutura_xlsx_desabilitada' using errcode='55000'; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if v_ator is null or p_cliente is null or p_origem is null or p_origem<>btrim(p_origem) or length(p_origem) not between 1 and 200
    or p_aba is null or length(p_aba) not between 1 and 31 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('estrutura-xlsx-origem:'||jsonb_build_array(p_cliente,p_origem)::text,0));
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*) into v_total from pcm.sso_estrutura_xlsx_recibos where cliente_id=p_cliente and origem=p_origem;
  if v_total>1 then return jsonb_build_object('estado','reconciliacao'); end if;
  if v_total=0 then
    if exists(select 1 from pcm.sso_levantamentos where cliente_id=p_cliente and origem='manual' and chave_origem=p_origem)
      or exists(select 1 from pcm.sso_quarentena_csv_lotes where cliente_id=p_cliente and chave_origem=p_origem) then
      return jsonb_build_object('estado','reconciliacao'); end if;
    return jsonb_build_object('estado','ausente');
  end if;
  select * into v_rec from pcm.sso_estrutura_xlsx_recibos where cliente_id=p_cliente and origem=p_origem;
  if v_rec.ator_id is distinct from v_ator or v_rec.aba is distinct from p_aba then return jsonb_build_object('estado','reconciliacao'); end if;
  v_id:=case when v_rec.destino='lote' then v_rec.resultado->'recibo'->>'aggregateId' else v_rec.resultado->'recibo'->>'quarentenaId' end;
  if v_id is null or v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'recibo_inconsistente' using errcode='23514'; end if;
  return jsonb_build_object('estado','encontrado','requestId',v_rec.request_id,'sha256',v_rec.sha256,'destino',v_rec.destino,'id',v_id::uuid);
end; $$;
revoke all on function pcm.sso_recuperar_estrutura_xlsx(uuid,text,text) from public,anon,authenticated,service_role;
