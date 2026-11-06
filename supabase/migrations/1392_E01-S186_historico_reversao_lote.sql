-- ADR-1239: histórico mínimo, sem fotografias ou alterações.
create function pcm.sso_listar_reversoes_lote_legado(p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,motivo text,criado_em timestamptz,revertidos integer,pendentes integer,itens jsonb)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_lote_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_exigir_consulta_reversao_lote(p_ator_id,p_cliente_id);
  if not exists(select 1 from pcm.sso_lotes_rascunhos_legados l where l.request_id=p_lote_id and l.cliente_id=p_cliente_id) then raise exception 'lote_indisponivel' using errcode='42501'; end if;
  return query select r.request_id,r.ator_id,r.motivo,r.criado_em,(r.resultado->>'revertidos')::integer,(r.resultado->>'pendentes')::integer,
    (select coalesce(jsonb_agg(jsonb_build_object('planoId',e->'aggregateId','revisao',e->'revision','estado',e->'state') order by e->>'aggregateId'),'[]'::jsonb)
      from jsonb_array_elements(r.resultado->'itens') e)
    from pcm.sso_reversoes_lote_legado r where r.cliente_id=p_cliente_id and r.lote_request_id=p_lote_id
      and (p_apos is null or r.request_id>p_apos) order by r.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_reversoes_lote_legado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_reversoes_lote_legado(uuid,uuid,uuid,uuid,integer) to authenticated;
