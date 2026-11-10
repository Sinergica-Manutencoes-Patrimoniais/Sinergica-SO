-- ADR-1309: consulta de recibo sem declarar nova exigência.
create function pcm.sso_recibo_exigencia_rotina(
 p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,
 p_expected_plano integer,p_expected_declaracao integer,p_classificacao text,p_referencia text,p_justificativa text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_declaracoes_exigencia_rotina%rowtype;v_payload jsonb;
 v_ref text:=nullif(btrim(p_referencia),'');v_motivo text:=nullif(btrim(p_justificativa),'');
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_plano_id is null
   or p_versao_id is null or p_rotina_id is null or p_expected_plano is null or p_expected_plano<1
   or p_expected_declaracao is null or p_expected_declaracao<0 or p_classificacao is null
   or p_classificacao not in ('legal_normativa','nao_classificada') or v_motivo is null or length(v_motivo)>2000
   or length(coalesce(v_ref,''))>500 or (p_classificacao='legal_normativa' and v_ref is null) then
   raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_exigencia_legal_gate where id and habilitado for share;
 if not found then raise exception 'exigencia_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,
   'revisaoPlano',p_expected_plano,'revisaoDeclaracao',p_expected_declaracao,'classificacao',p_classificacao,'referencia',v_ref,'justificativa',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exigencia-rotina-request:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_declaracoes_exigencia_rotina where request_id=p_request_id;
 if not found then return null; end if;
 if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then
   raise exception 'sem_acesso_ou_tentativa_divergente' using errcode='42501'; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for share;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_ant.resultado;
end; $$;
revoke all on function pcm.sso_recibo_exigencia_rotina(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_exigencia_rotina(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) to authenticated;
