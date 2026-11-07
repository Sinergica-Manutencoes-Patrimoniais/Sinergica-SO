-- ADR-1427: projeção explícita, sem expor payload privado completo.
create function pcm.sso_listar_historico_custos_proposta(p_cliente_id uuid,p_proposta_id uuid,p_antes integer,p_limite integer)
returns table(versao integer,criado_em timestamptz,custo_total_centavos bigint,piso_centavos bigint,preco_sugerido_centavos bigint,preco_centavos bigint)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_limite is null or p_limite not between 1 and 50 or (p_antes is not null and p_antes < 1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  perform pcm.sso_consultar_custos_proposta(p_cliente_id,p_proposta_id);
  return query select v.versao,v.criado_em,
    case when jsonb_typeof(foto.dados->'custo_total_centavos')='number' and foto.dados->>'custo_total_centavos' ~ '^[0-9]{1,15}$' then (foto.dados->>'custo_total_centavos')::bigint end,
    case when jsonb_typeof(foto.dados->'piso_centavos')='number' and foto.dados->>'piso_centavos' ~ '^[0-9]{1,15}$' then (foto.dados->>'piso_centavos')::bigint end,
    case when jsonb_typeof(foto.dados->'preco_sugerido_centavos')='number' and foto.dados->>'preco_sugerido_centavos' ~ '^[0-9]{1,15}$' then (foto.dados->>'preco_sugerido_centavos')::bigint end,
    case when jsonb_typeof(foto.dados->'preco_centavos')='number' and foto.dados->>'preco_centavos' ~ '^[0-9]{1,15}$' then (foto.dados->>'preco_centavos')::bigint end
    from comercial.proposta_versoes v
    cross join lateral (select case when jsonb_typeof(v.payload->'proposta')='object' then v.payload->'proposta' else v.payload end as dados) foto
    where v.proposta_id=p_proposta_id and (p_antes is null or v.versao<p_antes)
    order by v.versao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_historico_custos_proposta(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_historico_custos_proposta(uuid,uuid,integer,integer) to authenticated;
