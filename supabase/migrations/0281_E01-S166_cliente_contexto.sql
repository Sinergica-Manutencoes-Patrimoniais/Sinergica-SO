-- ADR-0057: cliente informado é conferência, não autoridade.
create function pcm.sso_criar_regra_contratual_v2(
  p_request_id uuid, p_expected_revision integer, p_serie_id uuid, p_regra_id uuid, p_cliente_id uuid, p_contrato_id uuid,
  p_ancora_semana date, p_dia_semana integer, p_intervalo_semanas integer, p_hora_inicio time,
  p_duracao_minutos integer, p_deslocamento_minutos integer, p_fuso text, p_vigencia_inicio date, p_vigencia_fim date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_cliente_id is null or p_contrato_id is null then raise exception 'regra_invalida' using errcode = '22023'; end if;
  select c.cliente_id into v_cliente from comercial.contratos c where c.id = p_contrato_id for share;
  if not found or v_cliente is distinct from p_cliente_id or not config.sso_autorizar_acao('plano.gerir', v_cliente) then
    raise exception 'contrato_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return pcm.sso_criar_regra_contratual(p_request_id, p_expected_revision, p_serie_id, p_regra_id, p_contrato_id,
    p_ancora_semana, p_dia_semana, p_intervalo_semanas, p_hora_inicio, p_duracao_minutos,
    p_deslocamento_minutos, p_fuso, p_vigencia_inicio, p_vigencia_fim);
end;
$$;
revoke all on function pcm.sso_criar_regra_contratual_v2(uuid, integer, uuid, uuid, uuid, uuid, date, integer, integer, time, integer, integer, text, date, date) from public, anon;
grant execute on function pcm.sso_criar_regra_contratual_v2(uuid, integer, uuid, uuid, uuid, uuid, date, integer, integer, time, integer, integer, text, date, date) to authenticated;
