-- Clone descartável; comandos reais; gate habilitado somente no rollback.
begin;
\ir manual_E01-S166_decisao_ativacao_1728.sql
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem) values ('16660000-0000-4000-8000-000000000032','sistema','16660000-0000-4000-8000-000000000033','plano');
update pcm.sso_preparar_ciclo_vencido_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_identidade_ciclo_gate set habilitado=true where id;
update pcm.ocorrencia_rotina_gate set habilitado=true where id;
update pcm.sso_guarda_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_pmoc_mediado_gate set habilitado=true where id;
update pcm.sso_diagnostico_pmoc_gate set habilitado=true where id;
update pcm.sso_decisao_pmoc_gate set habilitado=true where id;
update pcm.sso_vinculo_ciclo_pmoc_gate set habilitado=true where id;
update pcm.sso_origem_lote_gate set habilitado=true where id;
update pcm.sso_origem_rotina_gate set habilitado=true where id;
update pcm.sso_fila_preventiva_pcm_gate set habilitado=true where id;
update pcm.sso_fila_sem_vinculo_gate set habilitado=true where id;
update pcm.sso_estado_ocorrencia_vinculada_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17340000-0000-4000-8000-000000000001','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.sp')::date,'fixture');
select pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17340000-0000-4000-8000-000000000002','16660000-0000-4000-8000-000000000011',2,'retomar',current_setting('sso.fixture.sp')::date,'fixture');
reset role;
do $$ begin if exists(select 1 from pcm.ocorrencias_rotina_preparadas where plano_id='16660000-0000-4000-8000-000000000011') then raise exception 'retomada_gerou_automaticamente';end if;end $$;
set local role authenticated;
select pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17340000-0000-4000-8000-000000000003','17340000-0000-4000-8000-000000000004','16660000-0000-4000-8000-000000000011',3,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.sp')::date-1,'avaliar','Conferir vencido');
reset role;
-- Ajuste sintético de fuso apenas na fixture; preserva a data civil da decisão.
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{fuso_plano,fuso}',to_jsonb('America/Sao_Paulo'::text)) where id='16660000-0000-4000-8000-000000000021';
set local session_replication_role=origin;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
set local role authenticated;
do $$ declare r jsonb;f jsonb;begin
 r:=pcm.sso_preparar_ciclo_vencido('17340000-0000-4000-8000-000000000005','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',3,current_setting('sso.fixture.sp')::date-1);
 f:=pcm.sso_alterar_fila_preventiva_pcm('17340000-0000-4000-8000-000000000006','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',(r->>'preparadaId')::uuid,'incluir',0,'Conferir elegibilidade');
 if f->>'estado'<>'verificacao' then raise exception 'fila_inesperada: %',f;end if;
end $$;
reset role;
rollback;
