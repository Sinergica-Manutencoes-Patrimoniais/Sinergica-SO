-- ADR-1224: decisão vinculada à publicação atualmente visível; núcleo permanece privado.
create function comercial.sso_portal_decidir_proposta_mediada(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_request_id uuid,p_proposta_id uuid,p_versao integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_preco_publico text; v_preco numeric;
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_versao is null or p_versao<1
    or p_decisao not in ('aceita','recusada') or p_decisao is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-proposta:' || p_request_id::text,0));
  perform comercial.sso_exigir_historico_proposta_portal(p_ator_id,p_cliente_id,p_os_id,p_proposta_id);
  if comercial.sso_orcamento_publico_visivel(p_proposta_id,p_versao) is distinct from true then raise exception 'proposta_indisponivel' using errcode='42501'; end if;
  select comercial.projecao_proposta_publica(pub.payload_publico)->'proposta'->>'preco_centavos',p.preco_centavos
    into v_preco_publico,v_preco from comercial.sso_orcamento_publicacoes pub join comercial.propostas p on p.id=pub.proposta_id
    where pub.proposta_id=p_proposta_id and pub.versao=p_versao and p.versao_atual=p_versao;
  if not found then raise exception 'proposta_indisponivel' using errcode='42501'; end if;
  if p_decisao='aceita' then
    if v_preco_publico is null or v_preco_publico !~ '^(0|[1-9][0-9]{0,15})$' or v_preco is null or v_preco<0 then raise exception 'preco_indisponivel' using errcode='23514'; end if;
    if v_preco_publico::numeric is distinct from v_preco then raise exception 'preco_indisponivel' using errcode='23514'; end if;
  end if;
  return comercial.sso_portal_decidir_proposta_versionada(p_request_id,p_proposta_id,p_versao,p_decisao,p_motivo);
end; $$;
revoke all on function comercial.sso_portal_decidir_proposta_mediada(uuid,uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_portal_decidir_proposta_mediada(uuid,uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
