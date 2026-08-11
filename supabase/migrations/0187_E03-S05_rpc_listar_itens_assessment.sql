-- 0187_E03-S05_rpc_listar_itens_assessment.sql — Sinérgica SO
-- Story E03-S05, AC-4/AC-5. Interface de leitura publicada pelo PCM (ADR-0019 R2) para o Comercial
-- importar itens do Assessment na composição da proposta — sem `select` direto em
-- `pcm.inspecao_itens`. Mesma guarda de `pcm.fn_listar_assessments_conta` (0185): comercial OU pcm
-- OU superadmin, independente do resultado do item.
--
-- `p_cliente_id` é redundante com `p_inspecao_id` (o assessment já sabe sua Conta), mas exigido
-- de propósito: reforça no banco o caso de borda "Assessment de outra Conta não pode ser
-- vinculado" (spec.md) — se o id da inspeção não pertencer à Conta informada, a função nega antes
-- de devolver qualquer item, mesmo que o chamador tenha módulo comercial em outra Conta.
--
-- Reverso:
--   drop function if exists pcm.fn_listar_itens_assessment(uuid, uuid);

create or replace function pcm.fn_listar_itens_assessment(p_inspecao_id uuid, p_cliente_id uuid)
returns table(
  id uuid,
  sistema text,
  localizacao text,
  descricao text,
  resultado text,
  severidade text,
  recomendacao text,
  categoria text,
  elemento text
)
language plpgsql
security definer
stable
set search_path = pcm, pg_temp
as $$
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') in ('leitura', 'escrita')
    or (auth.jwt() -> 'user_modulos' ->> 'pcm') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_listar_itens_assessment' using errcode = '42501';
  end if;

  if not exists (
    select 1 from pcm.inspecoes i
     where i.id = p_inspecao_id
       and i.client_id = p_cliente_id
       and i.e_assessment = true
  ) then
    raise exception 'assessment % nao encontrado para a conta informada', p_inspecao_id
      using errcode = 'P0002';
  end if;

  return query
  select ii.id, ii.sistema, ii.localizacao, ii.descricao, ii.resultado, ii.severidade,
         ii.recomendacao, ii.categoria, ii.elemento
    from pcm.inspecao_itens ii
   where ii.inspecao_id = p_inspecao_id
   order by ii.created_at;
end;
$$;

revoke all on function pcm.fn_listar_itens_assessment(uuid, uuid) from public;
grant execute on function pcm.fn_listar_itens_assessment(uuid, uuid) to authenticated;

comment on function pcm.fn_listar_itens_assessment(uuid, uuid) is
  'E03-S05: interface de leitura publicada pelo PCM para o Comercial importar itens do Assessment '
  'na composição da proposta (ADR-0019 R2). p_cliente_id valida que o assessment pertence à Conta '
  'informada, reforçando no banco o caso de borda de Assessment de outra Conta.';
