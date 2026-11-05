-- Clone sintético, em transação revertida; recursos PMOC e Auvo não são modificados.
\ir manual_E01-S166_pmoc_lote_ac5_setup.sql
update pcm.sso_lote_calendario_conferido_gate set habilitado=true where id;
create temporary table fixture_ac5_baseline as select (select count(*) from pcm.pmoc_schedules) pmoc,(select count(*) from pcm.ordens_servico) os,(select count(*) from pcm.auvo_sync_outbox) outbox;
set local role authenticated;
do $$ declare esperados jsonb; a jsonb;b jsonb;inicio date:=current_date;fim date:=current_date+30;begin
 select jsonb_agg(jsonb_build_object('ciclo',i,'vencimento',(inicio+i)::text) order by i) into esperados from generate_series(0,30) i;
 a:=pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000001','17690000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,inicio,fim,esperados);
 b:=pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000001','17690000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,inicio,fim,esperados);
 if a is distinct from b or (a->>'total')::int<>31 or not exists(select 1 from jsonb_array_elements(a->'itens') x where (x->>'vencimentoOriginal')::date=fim) then raise exception 'janela_ou_replay_divergente';end if;
 begin perform pcm.sso_materializar_lote_calendario_origem_conferida('16630000-1111-4000-8000-000000000001','17690000-1111-4000-8000-000000000002','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,inicio,fim+1,esperados);raise exception 'dia_31_indevido';exception when invalid_parameter_value then if sqlerrm<>'janela_fora_do_limite' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>31 then raise exception 'quantidade_janela_incorreta';end if;
 if (select count(*) from pcm.pmoc_schedules)<>(select pmoc from fixture_ac5_baseline) or (select count(*) from pcm.ordens_servico)<>(select os from fixture_ac5_baseline) or (select count(*) from pcm.auvo_sync_outbox)<>(select outbox from fixture_ac5_baseline) then raise exception 'efeito_externo_indevido';end if;
end $$;
