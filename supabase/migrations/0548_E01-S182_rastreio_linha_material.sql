-- ADR-0322: projeção interna mínima, sem anexos ou custo de aquisição.
create function financeiro.sso_rastrear_candidato_linha(p_cliente_id uuid,p_item_id uuid)
returns table(declaracao_id uuid,os_id uuid,lista_id uuid,lista_revisao integer,descricao_declarada text,evidencia_declarada text,
  proposta_id uuid,versao integer,linha_id uuid,descricao_publica text,quantidade integer,preco_unitario_centavos text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_item_id is null
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_candidato_linha_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  return query select d.id,d.os_id,d.lista_id,d.lista_revisao,d.descricao,d.evidencia,x.proposta_id,x.versao,x.linha_id,
    e->>'descricao',x.quantidade,x.preco_unitario_centavos::text
    from financeiro.itens_faturaveis i join financeiro.sso_material_declaracoes d on d.id=i.origem_id and d.cliente_id=i.cliente_id
    join financeiro.sso_material_linha_proposta x on x.declaracao_id=d.id
    join financeiro.sso_material_proposta_vinculos v on v.declaracao_id=d.id and v.cliente_id=d.cliente_id and v.proposta_id=x.proposta_id and v.versao=x.versao
    join pcm.ordens_servico os on os.id=d.os_id and os.client_id=d.cliente_id
    join pcm.listas_materiais l on l.id=d.lista_id and l.cliente_id=d.cliente_id and l.ordem_servico_id=d.os_id
    join comercial.sso_itens_publicos_proposta s on s.proposta_id=x.proposta_id and s.versao=x.versao
    cross join lateral jsonb_array_elements(s.itens) e
    where i.id=p_item_id and i.cliente_id=p_cliente_id and i.origem_tipo='material_proposta_linha'
      and e->>'id'=x.linha_id::text and (e->>'precoUnitarioCentavos')::numeric=x.preco_unitario_centavos
      and i.valor_original_centavos=x.quantidade::numeric*x.preco_unitario_centavos;
end $$;
revoke all on function financeiro.sso_rastrear_candidato_linha(uuid,uuid) from public,anon,authenticated,service_role;
