-- ADR-1426: leitura paginada; autorização e gate reaproveitam ADR-1425.
create function pcm.sso_listar_itens_custo_proposta(p_cliente_id uuid,p_proposta_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,tipo text,descricao text,quantidade numeric,custo_unitario_centavos bigint,total_centavos bigint)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  perform pcm.sso_consultar_custos_proposta(p_cliente_id,p_proposta_id);
  return query select i.id,i.tipo,i.descricao,i.quantidade,i.custo_unitario_centavos,i.total_centavos
    from comercial.proposta_itens i where i.proposta_id=p_proposta_id and (p_apos is null or i.id>p_apos)
    order by i.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_itens_custo_proposta(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_itens_custo_proposta(uuid,uuid,uuid,integer) to authenticated;
