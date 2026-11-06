-- ADR-0971: leitura privada de procedência, sem aceitar ou validar a cópia.
create function pcm.sso_proveniencia_rotina_modelo(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_copia pcm.sso_copias_rotina_modelo%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_copia_rotina_modelo_gate where id and habilitado for share;
  if not found then raise exception 'copia_rotina_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id
    join pcm.rotinas_manutencao r on r.plano_id=p.id and r.versao_id=v.id
    where p.id=p_plano_id and p.cliente_id=p_cliente_id and v.id=p_versao_id and r.id=p_rotina_id
    for share of p,v,r;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_copia from pcm.sso_copias_rotina_modelo where destino_cliente_id=p_cliente_id and destino_plano_id=p_plano_id and destino_rotina_id=p_rotina_id;
  if not found then return jsonb_build_object('copiada',false,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id); end if;
  if config.sso_autorizar_acao('plano.gerir',v_copia.origem_cliente_id) is distinct from true then
    return jsonb_build_object('copiada',true,'origemAcessivel',false,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'conferenciaNecessaria',true);
  end if;
  return jsonb_build_object('copiada',true,'origemAcessivel',true,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,
    'origemClienteId',v_copia.origem_cliente_id,'origemPlanoId',v_copia.origem_plano_id,'origemVersaoId',v_copia.origem_versao_id,
    'origemRotinaId',v_copia.origem_rotina_id,'copiadaEm',v_copia.criado_em,'conferenciaNecessaria',true);
end; $$;
revoke all on function pcm.sso_proveniencia_rotina_modelo(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
