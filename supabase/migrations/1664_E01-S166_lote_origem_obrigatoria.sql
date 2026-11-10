-- ADR-1521: o lote multirrotina exige a guarda de origem existente durante o comando.
create function pcm.sso_materializar_lote_calendario_origem_conferida(
 p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,
 p_expected_revision integer,p_inicio date,p_fim date,p_esperados jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;
 if not found then raise exception 'origem_lote_desabilitada' using errcode='55000'; end if;
 r:=pcm.sso_materializar_lote_calendario_conferido(p_ator_id,p_request_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_inicio,p_fim,p_esperados);
 if auth.uid() is distinct from p_ator_id or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_materializar_lote_calendario_origem_conferida(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_materializar_lote_calendario_origem_conferida(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) to authenticated;
