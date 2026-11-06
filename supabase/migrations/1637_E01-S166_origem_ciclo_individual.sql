-- ADR-1494: a guarda do lote também protege chamadas individuais e reutilização.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date)'::regprocedure);
 v_antes text:=$antes$ select * into v_previa from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_vencimento);$antes$;
 v_depois text:=$depois$ perform pcm.sso_exigir_origem_plano_lote(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_vencimento);
 select * into v_previa from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_vencimento);$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_ciclo_individual_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
