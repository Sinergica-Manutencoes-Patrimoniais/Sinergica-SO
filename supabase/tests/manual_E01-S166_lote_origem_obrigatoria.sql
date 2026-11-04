-- Executar em banco sintético após migrations até 1664; chamador envolve em BEGIN/ROLLBACK.
\ir manual_E01-S166_pmoc_lote.sql
update pcm.sso_lote_calendario_conferido_gate set habilitado=true where id;
update pcm.sso_origem_lote_gate set habilitado=false where id;
set local role authenticated;
do $$ declare e jsonb:=jsonb_build_array(jsonb_build_object('ciclo',0,'vencimento',current_date::text)); begin
 begin perform pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000073','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date,e);raise exception 'gate_desligado_aceito';exception when object_not_in_prerequisite_state then if sqlerrm<>'origem_lote_desabilitada' then raise;end if;end;
 begin perform pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000099','16630000-1111-4000-8000-000000000073','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date,e);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
end; $$;
reset role;
update pcm.sso_origem_lote_gate set habilitado=true where id;
set local role authenticated;
do $$ declare a jsonb;b jsonb;e jsonb:=jsonb_build_array(jsonb_build_object('ciclo',0,'vencimento',current_date::text));begin
 a:=pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000073','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date,e);
 b:=pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000073','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date,e);
 if a is distinct from b or (a->>'total')::int<>1 or a->>'osCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'recibo_ou_replay_divergente: %',a;end if;
 begin perform pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000074','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date+1,jsonb_build_array(jsonb_build_object('ciclo',0,'vencimento',current_date::text),jsonb_build_object('ciclo',1,'vencimento',(current_date+1)::text)));raise exception 'origem_pmoc_obsoleta_aceita';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;
end; $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_materializar_lote_calendario_origem_conferida(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb)','execute') then raise exception 'acl_anon_indevida';end if;end; $$;
