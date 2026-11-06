-- E01-S184: força de preço exige administrador ativo, mesmo com JWT antigo.
-- Reverso: restituir grant da função legada (reabre risco de autorização revogada).
revoke execute on function comercial.fn_forcar_preco_abaixo_piso(uuid, bigint, text) from authenticated, public, anon;
create or replace function comercial.forcar_preco_abaixo_piso_seguro(
  p_proposta_id uuid, p_preco_centavos bigint, p_motivo text default null
) returns comercial.propostas
language plpgsql security definer set search_path = '' as $$
begin
  if not config.s184_pode_ver_custos() then
    raise exception 'sem_permissao_para_forcar_preco' using errcode = '42501';
  end if;
  return comercial.fn_forcar_preco_abaixo_piso(p_proposta_id, p_preco_centavos, p_motivo);
end;
$$;
revoke all on function comercial.forcar_preco_abaixo_piso_seguro(uuid, bigint, text) from public, anon;
grant execute on function comercial.forcar_preco_abaixo_piso_seguro(uuid, bigint, text) to authenticated;
