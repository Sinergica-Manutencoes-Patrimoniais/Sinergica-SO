-- ADR-0095: inventário agregado, sem reservar, alterar ou reconciliar códigos.
create function pcm.sso_inventariar_codigos_legados()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  if not exists(select 1 from config.usuarios u where u.user_id = auth.uid()
    and u.ativo and u.papel = 'superadmin' and auth.jwt()->>'user_role' = 'superadmin') then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  with codigos as materialized (
    select 'equipamento'::text as tipo, e.identificador as codigo,
      e.deleted_at is not null as excluido, e.client_id is null as sem_cliente
      from pcm.equipamentos e
    union all
    select 'sistema'::text, s.codigo, s.deleted_at is not null, false
      from pcm.sistemas s
  ), resumo as (
    select count(*) filter (where tipo = 'equipamento') as equipamentos,
      count(*) filter (where tipo = 'sistema') as sistemas,
      count(*) filter (where tipo = 'equipamento' and sem_cliente) as equipamentos_sem_cliente,
      count(*) filter (where excluido) as excluidos,
      count(*) filter (where codigo is null or btrim(codigo) = '') as vazios
    from codigos
  ), exatos as (
    select codigo from codigos where codigo is not null and btrim(codigo) <> ''
    group by codigo having count(*) > 1
  ), possiveis as (
    select upper(btrim(codigo)) as chave from codigos where codigo is not null and btrim(codigo) <> ''
    group by upper(btrim(codigo)) having count(*) > 1
  )
  select jsonb_build_object('equipamentos', r.equipamentos, 'sistemas', r.sistemas,
    'equipamentosSemCliente', r.equipamentos_sem_cliente, 'excluidos', r.excluidos,
    'codigosVazios', r.vazios, 'gruposDuplicadosExatos', (select count(*) from exatos),
    'gruposPossivelmenteEquivalentes', (select count(*) from possiveis)) into v_resultado from resumo r;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_inventariar_codigos_legados() from public, anon, authenticated, service_role;
grant execute on function pcm.sso_inventariar_codigos_legados() to authenticated;
