-- ADR-1291: consulta do pedido original, sem novo efeito.
create function pcm.sso_consultar_recibo_copia_rotina(p_ator_id uuid,p_request_id uuid,p_origem_cliente_id uuid,p_destino_cliente_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_copias_rotina_modelo%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_origem_cliente_id is null or p_destino_cliente_id is null
    or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_copia_rotina_modelo_gate where id and habilitado for share;
  if not found then raise exception 'copia_rotina_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_origem_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_destino_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v from pcm.sso_copias_rotina_modelo where request_id=p_request_id and ator_id=p_ator_id
    and origem_cliente_id=p_origem_cliente_id and destino_cliente_id=p_destino_cliente_id and payload=p_payload;
  if not found or not exists(select 1 from pcm.planos_manutencao where id=v.origem_plano_id and cliente_id=p_origem_cliente_id)
    or not exists(select 1 from pcm.planos_manutencao where id=v.destino_plano_id and cliente_id=p_destino_cliente_id) then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return v.resultado;
end; $$;
revoke all on function pcm.sso_consultar_recibo_copia_rotina(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recibo_copia_rotina(uuid,uuid,uuid,uuid,jsonb) to authenticated;
