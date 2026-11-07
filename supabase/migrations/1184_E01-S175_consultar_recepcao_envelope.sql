-- ADR-1033: somente o ator da tentativa, sem fornecer payload persistido.
create function pcm.sso_consultar_recepcao_envelope(
  p_ator_id uuid, p_cliente_id uuid, p_os_id uuid, p_envelope_id uuid,
  p_request_id uuid, p_linhas jsonb, p_fotos jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_registro pcm.sso_recepcao_envelope_campo%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode = '42501'; end if;
  if p_cliente_id is null or p_os_id is null or p_envelope_id is null or p_request_id is null
    or pg_catalog.jsonb_typeof(p_linhas) is distinct from 'array' or pg_catalog.jsonb_typeof(p_fotos) is distinct from 'array'
    or pg_catalog.octet_length(p_linhas::text) > 1048576 or pg_catalog.octet_length(p_fotos::text) > 262144 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_recepcao_envelope_campo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'recepcao_envelope_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  select * into v_registro from pcm.sso_recepcao_envelope_campo where request_id = p_request_id and ator_id = p_ator_id;
  if not found or v_registro.envelope_id is distinct from p_envelope_id or v_registro.cliente_id is distinct from p_cliente_id
    or v_registro.os_id is distinct from p_os_id or v_registro.linhas is distinct from p_linhas
    or v_registro.fotos_declaradas is distinct from p_fotos then raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  return v_registro.resultado;
end;
$$;
revoke all on function pcm.sso_consultar_recepcao_envelope(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
