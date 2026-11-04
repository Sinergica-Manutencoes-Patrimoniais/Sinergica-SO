-- ADR-0805: ordem opt-in nas quatro fronteiras existentes. Gate 0787 permanece desligado.
-- Não autoriza materialização operacional nem prova coordenação com PMOC/legado.
create function pcm.sso_guardar_ordem_ciclo(p_cliente_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_concorrencia_impacto_gate where id),false) then return; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
   raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then
   raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then
   raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
   raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_guardar_ordem_ciclo(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_guardar_ordem_ciclo(uuid) to postgres;

-- Preserve OID, assinatura e ACL. Qualquer divergência nas definições esperadas aborta.
do $$
declare v_item record; v_def text; v_marcador text; v_pos integer;
begin
 for v_item in select * from (values
  ('pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date)', 'sso_materializar_ciclo_canonico_gate'),
  ('pcm.sso_materializar_ciclo_legado(uuid,uuid,uuid,uuid,uuid,uuid,text)', 'sso_materializar_ciclo_legado_gate'),
  ('pcm.sso_materializar_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date)', 'sso_lote_ciclos_calendario_gate'),
  ('pcm.sso_materializar_lote_legado(uuid,uuid,uuid,uuid,uuid,integer,uuid[],text)', 'sso_lote_ciclos_legados_gate')
 ) as t(assinatura,gate)
 loop
  v_def := pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);
  v_marcador := E'begin\n if not coalesce((select habilitado from pcm.' || v_item.gate;
  v_pos := strpos(v_def,v_marcador);
  if v_pos=0 or strpos(substr(v_def,v_pos+length(v_marcador)),v_marcador)>0
    or strpos(v_def,'sso_guardar_ordem_ciclo')>0 then
    raise exception 'definicao_ciclo_incompativel: %',v_item.assinatura using errcode='55000';
  end if;
  v_def := overlay(v_def placing E'begin\n perform pcm.sso_guardar_ordem_ciclo(p_cliente_id);\n if not coalesce((select habilitado from pcm.' || v_item.gate from v_pos for length(v_marcador));
  execute v_def;
 end loop;
end; $$;
