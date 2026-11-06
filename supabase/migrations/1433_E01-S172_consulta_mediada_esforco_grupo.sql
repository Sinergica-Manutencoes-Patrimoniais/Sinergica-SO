-- ADR-1286: mantém o cálculo privado e expõe somente uma consulta autenticada.
create function pcm.sso_prever_esforco_grupo_mediado(
  p_ator_id uuid, p_cliente_id uuid, p_ocorrencia_id uuid
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_ocorrencia_id is null then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_esforco_grupo_gate where id and habilitado for share;
  if not found then raise exception 'esforco_grupo_bloqueado' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  v_resultado := pcm.sso_prever_esforco_grupo(p_cliente_id,p_ocorrencia_id);
  if v_resultado->>'ocorrenciaId' is distinct from p_ocorrencia_id::text
    or coalesce(v_resultado->>'estado','') not in ('estimativa','tempo_a_validar')
    or v_resultado->'capacidadeReservada' is distinct from 'false'::jsonb then
    raise exception 'resultado_divergente' using errcode = '23514';
  end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_prever_esforco_grupo_mediado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_esforco_grupo_mediado(uuid,uuid,uuid) to authenticated;
