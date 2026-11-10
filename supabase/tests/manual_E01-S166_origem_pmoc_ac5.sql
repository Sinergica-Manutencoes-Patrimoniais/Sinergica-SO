-- O vínculo de origem é preparado sinteticamente; comandos de geração são reais, em transação revertida.
\ir manual_E01-S166_origem_pmoc_ac5_setup.sql
reset role;
set local session_replication_role=replica;
update pcm.rotina_origem_geracao set origem='pmoc' where rotina_logica_id='16630000-1111-4000-8000-000000000032';
set local session_replication_role=origin;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_materializar_lote_calendario('17690000-1111-4000-8000-000000000003','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date);raise exception 'origem_pmoc_gerou_plano';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;
end $$;
reset role;
do $$ begin if exists(select 1 from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011') then raise exception 'ocorrencia_indevida';end if;end $$;
