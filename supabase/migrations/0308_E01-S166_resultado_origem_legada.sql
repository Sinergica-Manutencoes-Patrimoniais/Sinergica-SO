-- ADR-0084: verificar origem antes de atualizar ou retornar resultado legado.
create or replace function pcm.atualizar_resultado_preventiva(
  p_ocorrencia_id uuid, p_resultado text, p_atualizado_em timestamptz
) returns text language plpgsql security definer set search_path = pcm, public as $$
declare v_ocorrencia pcm.ocorrencias_preventivas%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Somente service_role sincroniza resultado preventivo' using errcode = '42501';
  end if;
  if p_resultado not in ('pendente', 'ok', 'nao_ok') then
    raise exception 'Resultado preventivo inválido' using errcode = '22023';
  end if;
  if p_atualizado_em is null then
    raise exception 'Data de atualização é obrigatória' using errcode = '22023';
  end if;
  select * into v_ocorrencia from pcm.ocorrencias_preventivas where id = p_ocorrencia_id for update;
  if not found then raise exception 'Ocorrência preventiva não encontrada' using errcode = 'P0002'; end if;
  if v_ocorrencia.origem is distinct from 'legado' then
    raise exception 'origem_preventiva_incompativel' using errcode = '23514';
  end if;
  if v_ocorrencia.resultado_atualizado_em is null or p_atualizado_em >= v_ocorrencia.resultado_atualizado_em then
    update pcm.ocorrencias_preventivas set resultado_estado = p_resultado, resultado_atualizado_em = p_atualizado_em
      where id = p_ocorrencia_id returning resultado_estado into v_ocorrencia.resultado_estado;
  end if;
  return v_ocorrencia.resultado_estado;
end;
$$;
revoke all on function pcm.atualizar_resultado_preventiva(uuid, text, timestamptz) from public;
grant execute on function pcm.atualizar_resultado_preventiva(uuid, text, timestamptz) to service_role;
