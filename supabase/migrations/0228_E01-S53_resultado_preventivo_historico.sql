-- E01-S53 AC-5/AC-9: o PCM guarda só o resultado operacional resumido.
-- Formulário, fotos e respostas completas permanecem no Auvo e em avaliacoes_preventivas.
-- Reverso: revoke/drop pcm.atualizar_resultado_preventiva(uuid,text,timestamptz),
-- depois remover as duas colunas (preservando primeiro qualquer histórico necessário).

alter table pcm.ocorrencias_preventivas
  add column if not exists resultado_estado text not null default 'pendente'
    check (resultado_estado in ('pendente', 'ok', 'nao_ok')),
  add column if not exists resultado_atualizado_em timestamptz;

create index if not exists idx_ocorrencias_preventivas_historico
  on pcm.ocorrencias_preventivas(plano_id, vencimento desc);

create or replace function pcm.atualizar_resultado_preventiva(
  p_ocorrencia_id uuid,
  p_resultado text,
  p_atualizado_em timestamptz
)
returns text
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_resultado text;
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

  update pcm.ocorrencias_preventivas
  set resultado_estado = p_resultado,
      resultado_atualizado_em = p_atualizado_em
  where id = p_ocorrencia_id
    and (
      resultado_atualizado_em is null
      or p_atualizado_em >= resultado_atualizado_em
    )
  returning resultado_estado into v_resultado;

  if found then return v_resultado; end if;

  select resultado_estado into v_resultado
  from pcm.ocorrencias_preventivas
  where id = p_ocorrencia_id;
  if not found then raise exception 'Ocorrência preventiva não encontrada' using errcode = 'P0002'; end if;
  return v_resultado;
end;
$$;

revoke all on function pcm.atualizar_resultado_preventiva(uuid, text, timestamptz) from public;
grant execute on function pcm.atualizar_resultado_preventiva(uuid, text, timestamptz) to service_role;
