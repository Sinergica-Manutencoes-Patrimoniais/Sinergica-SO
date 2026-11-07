-- ADR-0912. Consulta aditiva, sujeita aos gates existentes; não altera dados.
create function pcm.sso_recuperar_origem_xlsx(p_cliente uuid, p_fonte text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_habilitado boolean; v_lote uuid; v_revisao integer; v_hash text;
begin
  select habilitado into v_habilitado from pcm.sso_origem_xlsx_cronograma_gate where id for share;
  if v_habilitado is distinct from true then raise exception 'origem_xlsx_bloqueada' using errcode='55000'; end if;
  perform pcm.sso_exigir_mediacao_cronograma(p_cliente);
  if p_cliente is null or p_fonte is null or p_fonte<>btrim(p_fonte) or length(p_fonte) not between 1 and 188 then
    raise exception 'origem_xlsx_invalida' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array(p_cliente,'planilha','cronograma:' || p_fonte)::text,0));
  select id,revisao into v_lote,v_revisao from pcm.sso_levantamentos
    where cliente_id=p_cliente and origem='planilha' and chave_origem='cronograma:' || p_fonte;
  if not found then return jsonb_build_object('estado','ausente'); end if;
  select sha256 into v_hash from pcm.sso_origens_xlsx_cronograma where lote_id=v_lote and cliente_id=p_cliente;
  if not found then return jsonb_build_object('estado','reconciliacao'); end if;
  return jsonb_build_object('estado','encontrada','loteId',v_lote,'revisao',v_revisao,'sha256',v_hash);
end; $$;
revoke all on function pcm.sso_recuperar_origem_xlsx(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recuperar_origem_xlsx(uuid,text) to authenticated;
