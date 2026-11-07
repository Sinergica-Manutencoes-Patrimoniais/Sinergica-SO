-- ADR-1556: a aprovação mediada não admite configuração parcial dos validadores existentes.
create function pcm.sso_exigir_validadores_revisao_ativos() returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_n integer;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' or pg_catalog.current_setting('session_replication_role')<>'origin' then raise exception 'transacao_invalida' using errcode='25001';end if;
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then raise exception 'validadores_revisao_indisponiveis' using errcode='55000';end if;
 perform 1 from pcm.sso_decisao_comparada_gate where id and habilitado for share;
 if not found then raise exception 'validadores_revisao_indisponiveis' using errcode='55000';end if;
 perform 1 from pcm.sso_data_civil_geracao_gate where id and habilitado for share;
 if not found then raise exception 'validadores_revisao_indisponiveis' using errcode='55000';end if;
 perform 1 from pcm.sso_snapshot_fuso_plano_gate where id and habilitado for share;
 if not found then raise exception 'validadores_revisao_indisponiveis' using errcode='55000';end if;
 -- Bloqueia alterações de DDL dos triggers até o fim do comando, sem serializar inserções.
 lock table pcm.aprovacao_revisao_tokens in row exclusive mode nowait;
 select count(*) into v_n from pg_catalog.pg_trigger t join (values
  ('sso_bloquear_aprovacao_impacto_indeterminado','pcm.sso_bloquear_aprovacao_impacto_indeterminado()'::regprocedure,7),
  ('sso_continuidades_na_aprovacao','pcm.sso_registrar_continuidades_aprovadas()'::regprocedure,5),
  ('sso_inventario_pmoc_na_aprovacao','pcm.sso_exigir_inventario_pmoc_aprovacao()'::regprocedure,5),
  ('sso_usos_pmoc_na_aprovacao','pcm.sso_registrar_usos_pmoc_aprovados()'::regprocedure,5),
  ('sso_exigir_comparacao_questionario_aprovacao','pcm.sso_exigir_comparacao_questionario_aprovacao()'::regprocedure,7),
  ('sso_retiradas_na_aprovacao','pcm.sso_registrar_retiradas_aprovadas()'::regprocedure,5),
  ('sso_validar_retiradas_antes_aprovacao','pcm.sso_verificar_retiradas_antes_aprovacao()'::regprocedure,7),
  ('sso_selar_alteracoes_ciclo_aprovadas','pcm.sso_selar_alteracoes_ciclo_aprovadas()'::regprocedure,5),
  ('sso_selar_nova_data_calendario','pcm.sso_selar_nova_data_calendario()'::regprocedure,5),
  ('sso_selar_nova_visita','pcm.sso_selar_nova_visita()'::regprocedure,5)
 ) e(nome,funcao,tipo) on e.nome=t.tgname and e.funcao=t.tgfoid and e.tipo=t.tgtype
 where t.tgrelid='pcm.aprovacao_revisao_tokens'::regclass and not t.tgisinternal and t.tgenabled in ('O','A') and t.tgqual is null;
 if v_n<>10 then raise exception 'validadores_revisao_indisponiveis' using errcode='55000';end if;
end; $$;
revoke all on function pcm.sso_exigir_validadores_revisao_ativos() from public,anon,authenticated,service_role;

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aprovar_revisao_mediada(uuid,uuid,uuid,integer,uuid,date)'::regprocedure);
 a text:=' v_resultado:=pcm.sso_aprovar_revisao_preparada(p_request_id,p_expected_revision,p_plano_id,p_vigencia);';
 b text:=$novo$ -- O núcleo confere ator, Cliente e payload também no replay; não criar novas exigências ao recibo já persistido.
 if not exists(select 1 from pcm.plano_comandos where request_id=p_request_id) then
  perform pcm.sso_exigir_validadores_revisao_ativos();
 end if;
 v_resultado:=pcm.sso_aprovar_revisao_preparada(p_request_id,p_expected_revision,p_plano_id,p_vigencia);$novo$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'wrapper_aprovacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
