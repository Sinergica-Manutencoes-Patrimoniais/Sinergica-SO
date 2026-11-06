-- ADR-1428: dados de uma versão, com paginação por posição da fotografia.
create function pcm.sso_listar_itens_historicos_custo(p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_apos integer,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_payload jsonb; v_itens jsonb; v_total integer; v_resultado jsonb;
begin
  if p_versao is null or p_versao < 1 or p_apos is null or p_apos < 0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  perform pcm.sso_consultar_custos_proposta(p_cliente_id,p_proposta_id);
  select v.payload into v_payload from comercial.proposta_versoes v where v.proposta_id=p_proposta_id and v.versao=p_versao;
  if not found then raise exception 'versao_indisponivel' using errcode='42501'; end if;
  if jsonb_typeof(v_payload->'itens') is distinct from 'array' then return jsonb_build_object('versao',p_versao,'disponivel',false,'total',null,'itens','[]'::jsonb); end if;
  v_itens:=v_payload->'itens'; v_total:=jsonb_array_length(v_itens);
  if v_total > 10000 then raise exception 'snapshot_excede_limite' using errcode='54000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('posicao',q.ordinalidade,'tipo',case when jsonb_typeof(q.item->'tipo')='string' then q.item->>'tipo' end,
      'descricao',case when jsonb_typeof(q.item->'descricao')='string' then left(q.item->>'descricao',2000) end,
      'quantidade',case when jsonb_typeof(q.item->'quantidade')='number' then q.item->'quantidade' end,
      'custoUnitarioCentavos',case when jsonb_typeof(q.item->'custo_unitario_centavos')='number' and q.item->>'custo_unitario_centavos' ~ '^[0-9]{1,15}$' then q.item->'custo_unitario_centavos' end,
      'totalCentavos',case when jsonb_typeof(q.item->'total_centavos')='number' and q.item->>'total_centavos' ~ '^[0-9]{1,15}$' then q.item->'total_centavos' end) order by q.ordinalidade),'[]'::jsonb)
    into v_resultado from (select x.item,x.ordinalidade from jsonb_array_elements(v_itens) with ordinality as x(item,ordinalidade)
      where x.ordinalidade>p_apos order by x.ordinalidade limit p_limite) q;
  return jsonb_build_object('versao',p_versao,'disponivel',true,'total',v_total,'itens',v_resultado);
end; $$;
revoke all on function pcm.sso_listar_itens_historicos_custo(uuid,uuid,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_itens_historicos_custo(uuid,uuid,integer,integer,integer) to authenticated;
