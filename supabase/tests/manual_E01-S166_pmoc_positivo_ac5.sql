-- Dados sintéticos em rollback; proposta, decisão, vínculo, classificação e bloqueio são comandos reais.
\ir manual_E01-S166_pmoc_positivo_ac5_setup.sql
reset role;
set local session_replication_role=replica;
update pcm.rotina_origem_geracao set origem='pmoc' where rotina_logica_id='16630000-1111-4000-8000-000000000032';
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,alvo}',jsonb_build_object('tipo','sistema','id','16630000-1111-4000-8000-000000000033')) where id='16630000-1111-4000-8000-000000000021';
set local session_replication_role=origin;
update pcm.sso_decisao_pmoc_gate set habilitado=true where id;
update pcm.sso_lote_ciclos_calendario_gate set habilitado=true where id;
create temporary table fixture_pmoc_ac5_fotos as select (select to_jsonb(s) from pcm.pmoc_schedules s where id='16630000-1111-4000-8000-000000000043') agenda,(select to_jsonb(c) from pcm.pmoc_contracts c where id='16630000-1111-4000-8000-000000000042') contrato,(select to_jsonb(p) from pcm.pmoc_properties p where id='16630000-1111-4000-8000-000000000041') imovel,(select count(*) from pcm.ordens_servico) os,(select count(*) from pcm.auvo_sync_outbox) outbox;
set local role authenticated;
do $$ declare p jsonb;v uuid;d jsonb;r jsonb;foto jsonb;begin
 p:=pcm.sso_propor_pmoc_mediado('16630000-1111-4000-8000-000000000001','17690000-1111-4000-8000-000000000011','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,'16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',current_date,'16630000-1111-4000-8000-000000000043','documento sintético conferido');v:=(p->>'propostaId')::uuid;
 d:=pcm.sso_decidir_pmoc_mediado('16630000-1111-4000-8000-000000000001','17690000-1111-4000-8000-000000000012','16630000-1111-4000-8000-00000000000a',v,0,'validada_pcm','referência sintética','confirmação sintética');
 r:=pcm.sso_vincular_ciclo_pmoc('16630000-1111-4000-8000-000000000001','17690000-1111-4000-8000-000000000013','16630000-1111-4000-8000-00000000000a',v,1,true,true,'referência sintética','vínculo sintético');
 select fotografia into foto from pcm.sso_listar_pmoc_ciclo_conferencia('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,null,20);
 perform pcm.sso_classificar_pmoc_ciclo('16630000-1111-4000-8000-000000000001','17690000-1111-4000-8000-000000000014','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,'16630000-1111-4000-8000-000000000043',0,foto,'referência sintética','classificação sintética','relacionado');
 r:=pcm.sso_consultar_origem_efetiva_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);
 if r->>'estado'<>'pmoc_vinculado' then raise exception 'origem_positiva_divergente: %',r;end if;
 begin perform pcm.sso_materializar_lote_calendario('17690000-1111-4000-8000-000000000015','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date);raise exception 'origem_duplicada_aceita';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;
end $$;
reset role;
do $$ begin if exists(select 1 from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011') then raise exception 'ocorrencia_plano_indevida';end if; if (select to_jsonb(s) from pcm.pmoc_schedules s where id='16630000-1111-4000-8000-000000000043') is distinct from (select agenda from fixture_pmoc_ac5_fotos) or (select to_jsonb(c) from pcm.pmoc_contracts c where id='16630000-1111-4000-8000-000000000042') is distinct from (select contrato from fixture_pmoc_ac5_fotos) or (select to_jsonb(p) from pcm.pmoc_properties p where id='16630000-1111-4000-8000-000000000041') is distinct from (select imovel from fixture_pmoc_ac5_fotos) or (select count(*) from pcm.ordens_servico)<>(select os from fixture_pmoc_ac5_fotos) or (select count(*) from pcm.auvo_sync_outbox)<>(select outbox from fixture_pmoc_ac5_fotos) then raise exception 'fonte_pmoc_ou_saida_alterada';end if;end $$;
