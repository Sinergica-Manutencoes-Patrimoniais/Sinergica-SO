-- ADR-1129: acrescenta procedência declarada ao histórico existente.
create function pcm.sso_listar_alertas_reprogramacao_v2(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,vencimento_declarado date,alertas jsonb,motivo text,criado_em timestamptz,origem_parcial boolean,destino_parcial boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_visita_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 return query select h.request_id,h.ator_id,h.vencimento_declarado,h.alertas,h.motivo,h.criado_em,p.origem_parcial,p.destino_parcial
  from pcm.sso_listar_alertas_reprogramacao(p_ator_id,p_cliente_id,p_visita_id,p_apos,p_limite) h
  left join pcm.sso_proveniencias_simulacao_visita p on p.request_id=h.request_id and p.cliente_id=p_cliente_id and p.visita_id=p_visita_id and p.ator_id=h.ator_id
  order by h.request_id;
end; $$;
revoke all on function pcm.sso_listar_alertas_reprogramacao_v2(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_alertas_reprogramacao_v2(uuid,uuid,uuid,uuid,integer) to authenticated;
