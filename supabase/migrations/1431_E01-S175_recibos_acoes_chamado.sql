-- ADR-1284: leitura por ator e tentativa integral, sem repetir escrita.
create function pcm.sso_consultar_acao_chamado_campo(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_request_id uuid,p_tipo text,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid;v_cliente uuid;v_os uuid;v_payload jsonb;v_normalizado jsonb;v_resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null or p_request_id is null
    or p_tipo is null or p_tipo not in ('triagem','uniao','cancelamento') or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>32768 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if p_tipo='triagem' then
    perform 1 from pcm.sso_triagem_chamado_campo_gate where id and habilitado for share;
    if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
    if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
    select ator_id,cliente_id,os_id,payload,resultado into v_ator,v_cliente,v_os,v_payload,v_resultado from pcm.sso_triagem_chamado_campo_decisoes where request_id=p_request_id;
    v_normalizado:=p_payload;
  elsif p_tipo='uniao' then
    perform 1 from pcm.sso_uniao_chamado_campo_gate where id and habilitado for share;
    if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
    if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
    select ator_id,cliente_id,os_id,payload,resultado into v_ator,v_cliente,v_os,v_payload,v_resultado from pcm.sso_unioes_chamado_campo where request_id=p_request_id;
    if not (p_payload ? 'osUpdatedAt') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
    if (p_payload->>'osUpdatedAt')::timestamptz is distinct from (v_payload->>'osUpdatedAt')::timestamptz then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
    v_normalizado:=p_payload-'osUpdatedAt'; v_payload:=v_payload-'osUpdatedAt';
  else
    perform 1 from pcm.sso_cancelamento_campo_gate where id and habilitado for share;
    if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
    if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
    select ator_id,cliente_id,os_id,payload,resultado into v_ator,v_cliente,v_os,v_payload,v_resultado from pcm.sso_cancelamentos_campo where request_id=p_request_id;
    if not (p_payload ? 'osUpdatedAt') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
    if (p_payload->>'osUpdatedAt')::timestamptz is distinct from (v_payload->>'osUpdatedAt')::timestamptz then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
    v_normalizado:=p_payload-'osUpdatedAt'; v_payload:=v_payload-'osUpdatedAt';
  end if;
  if v_ator is distinct from p_ator_id or v_cliente is distinct from p_cliente_id or v_os is distinct from p_os_id or v_payload is distinct from v_normalizado
    or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_consultar_acao_chamado_campo(uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_acao_chamado_campo(uuid,uuid,uuid,uuid,text,jsonb) to authenticated;
