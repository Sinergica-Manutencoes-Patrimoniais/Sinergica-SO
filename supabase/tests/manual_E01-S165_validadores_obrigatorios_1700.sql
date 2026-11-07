-- Somente clone descartável; executar em BEGIN/ROLLBACK. Não desabilita a guarda 1045.
do $$ begin
 begin perform pcm.sso_exigir_validadores_revisao_ativos();raise exception 'configuracao_parcial_aceita';
 exception when object_not_in_prerequisite_state then if sqlerrm<>'validadores_revisao_indisponiveis' then raise;end if;end;
end; $$;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
select pcm.sso_exigir_validadores_revisao_ativos();
savepoint trigger_desligado;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_inventario_pmoc_na_aprovacao;
do $$ begin
 begin perform pcm.sso_exigir_validadores_revisao_ativos();raise exception 'trigger_ausente_aceito';
 exception when object_not_in_prerequisite_state then if sqlerrm<>'validadores_revisao_indisponiveis' then raise;end if;end;
end; $$;
rollback to savepoint trigger_desligado;
savepoint guarda_desligada;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_bloquear_aprovacao_impacto_indeterminado;
do $$ begin
 begin perform pcm.sso_exigir_validadores_revisao_ativos();raise exception 'guarda_1045_desligada_aceita';
 exception when object_not_in_prerequisite_state then if sqlerrm<>'validadores_revisao_indisponiveis' then raise;end if;end;
end; $$;
rollback to savepoint guarda_desligada;
savepoint gate_desligado;
update pcm.sso_decisao_comparada_gate set habilitado=false where id;
do $$ begin
 begin perform pcm.sso_exigir_validadores_revisao_ativos();raise exception 'gate_desligado_aceito';
 exception when object_not_in_prerequisite_state then if sqlerrm<>'validadores_revisao_indisponiveis' then raise;end if;end;
end; $$;
rollback to savepoint gate_desligado;
do $$ declare t text;begin
 foreach t in array array['sso_data_civil_geracao_gate','sso_snapshot_fuso_plano_gate'] loop
  execute format('update pcm.%I set habilitado=false where id',t);
  begin perform pcm.sso_exigir_validadores_revisao_ativos();raise exception 'gate_fuso_desligado_aceito';
  exception when object_not_in_prerequisite_state then if sqlerrm<>'validadores_revisao_indisponiveis' then raise;end if;end;
  execute format('update pcm.%I set habilitado=true where id',t);
 end loop;
end; $$;
do $$ begin
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='pcm.aprovacao_revisao_tokens'::regclass and tgname='sso_bloquear_aprovacao_impacto_indeterminado' and tgenabled='O') then raise exception 'guarda_1045_inalterada_ausente';end if;
 if has_function_privilege('authenticated','pcm.sso_exigir_validadores_revisao_ativos()','execute') or has_function_privilege('anon','pcm.sso_exigir_validadores_revisao_ativos()','execute') then raise exception 'acl_incorreta';end if;
end; $$;
