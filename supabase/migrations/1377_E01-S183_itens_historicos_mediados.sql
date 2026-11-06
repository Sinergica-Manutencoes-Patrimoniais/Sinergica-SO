-- ADR-1222: projeção explícita de campos públicos, sem custos internos.
create function comercial.sso_portal_itens_historicos_mediados(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb; v_itens jsonb; v_publico jsonb;
begin
  if p_versao is null or p_versao<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform comercial.sso_exigir_historico_proposta_portal(p_ator_id,p_cliente_id,p_os_id,p_proposta_id);
  perform 1 from comercial.sso_itens_publicos_gate where id and habilitado for share;
  if not found then raise exception 'indisponivel' using errcode='55000'; end if;
  v_resultado:=comercial.sso_portal_itens_publicos_historico(p_cliente_id,p_os_id,p_proposta_id,p_versao);
  v_itens:=v_resultado->'itens';
  if jsonb_typeof(v_resultado->'estruturado') is distinct from 'boolean' or jsonb_typeof(v_itens) is distinct from 'array'
    or jsonb_array_length(v_itens)>100 or ((v_resultado->>'estruturado')::boolean <> (jsonb_array_length(v_itens)>0)) then raise exception 'itens_indisponiveis' using errcode='42501'; end if;
  if exists(select 1 from jsonb_array_elements(v_itens) x where jsonb_typeof(x) is distinct from 'object'
    or jsonb_typeof(x->'id') is distinct from 'string' or jsonb_typeof(x->'descricao') is distinct from 'string'
    or jsonb_typeof(x->'quantidade') is distinct from 'number' or jsonb_typeof(x->'precoUnitarioCentavos') is distinct from 'number') then
    raise exception 'itens_indisponiveis' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','descricao',x->'descricao','quantidade',x->'quantidade',
    'precoUnitarioCentavos',x->'precoUnitarioCentavos') order by n),'[]'::jsonb) into v_publico from jsonb_array_elements(v_itens) with ordinality as a(x,n);
  return jsonb_build_object('estruturado',v_resultado->'estruturado','itens',v_publico);
end; $$;
revoke all on function comercial.sso_portal_itens_historicos_mediados(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_portal_itens_historicos_mediados(uuid,uuid,uuid,uuid,integer) to authenticated;
