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
update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16660000-0000-4000-8000-000000000001','chamado.os.criar','16660000-0000-4000-8000-00000000000a');
update pcm.sso_fila_sem_vinculo_gate set habilitado=true where id;
update pcm.sso_estado_ocorrencia_vinculada_gate set habilitado=true where id;
-- Plano legado e cadastro sintéticos; a relação e ponte serão comandos reais.
insert into pcm.questionarios(id,auvo_id,nome,ativo) values('17350000-0000-4000-8000-000000000011',17350011,'Questionário fixture',true);
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values('17350000-0000-4000-8000-000000000012','Tipo fixture',17350012,'16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-000000000001');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by)
values('17350000-0000-4000-8000-000000000013','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000033','17350000-0000-4000-8000-000000000011','17350000-0000-4000-8000-000000000012','Plano legado fixture',current_setting('sso.fixture.sp')::date-1,'meses',1,'ativo','16660000-0000-4000-8000-000000000001');
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_legado_gate set habilitado=true where id;
update pcm.sso_integrar_ciclo_existente_gate set habilitado=true where id;
update pcm.sso_vinculo_visita_legado_gate set habilitado=true where id;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16660000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select pcm.materializar_ocorrencias_preventivas('17350000-0000-4000-8000-000000000013',current_setting('sso.fixture.sp')::date-1);
insert into pcm.avaliacoes_preventivas(ocorrencia_id,chave_origem) select id,'fixture-1735' from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0;
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
update pcm.plano_versoes set snapshot=jsonb_set(jsonb_set(snapshot,'{fuso_plano,fuso}',to_jsonb('America/Sao_Paulo'::text)),'{rotinas,0,questionario_id}',to_jsonb('17350000-0000-4000-8000-000000000011'::text)) where id='16660000-0000-4000-8000-000000000021';
set local session_replication_role=origin;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
set local role authenticated;
do $$ declare r jsonb;f jsonb;g jsonb;h jsonb;begin
 r:=pcm.sso_preparar_ciclo_vencido('17340000-0000-4000-8000-000000000005','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',3,current_setting('sso.fixture.sp')::date-1);
 perform pcm.sso_declarar_relacao_legada_mediada('16660000-0000-4000-8000-000000000001','17350000-0000-4000-8000-000000000014','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','17350000-0000-4000-8000-000000000013',0,'declarar','Relação conferida');
 begin
  perform pcm.sso_integrar_legado_existente_mediado('16660000-0000-4000-8000-000000000001','17350000-0000-4000-8000-000000000017','16660000-0000-4000-8000-00000000000a',(r->>'preparadaId')::uuid,(select id from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0),'17350000-0000-4000-8000-000000000018','17350000-0000-4000-8000-000000000014','Ciclo com avaliação');
  raise exception 'avaliacao_aceita_como_inerte';
 exception when check_violation then if sqlerrm<>'legada_exige_reconciliacao' then raise;end if;end;
 execute 'reset role';
 delete from pcm.avaliacoes_preventivas where chave_origem='fixture-1735';
 execute 'set local role authenticated';
 g:=pcm.sso_integrar_legado_existente_mediado('16660000-0000-4000-8000-000000000001','17350000-0000-4000-8000-000000000015','16660000-0000-4000-8000-00000000000a',(r->>'preparadaId')::uuid,(select id from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0),'17350000-0000-4000-8000-000000000016','17350000-0000-4000-8000-000000000014','Ciclo conferido');
 h:=pcm.sso_integrar_legado_existente_mediado('16660000-0000-4000-8000-000000000001','17350000-0000-4000-8000-000000000015','16660000-0000-4000-8000-00000000000a',(r->>'preparadaId')::uuid,(select id from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0),'17350000-0000-4000-8000-000000000016','17350000-0000-4000-8000-000000000014','Ciclo conferido');
 if g is distinct from h or g->>'vinculoCriado'<>'true' or g->>'osCriada'<>'false' or g->>'tarefaAuvoCriada'<>'false' then raise exception 'ponte_ou_replay_divergente';end if;
 execute 'reset role';
 insert into pcm.avaliacoes_preventivas(ocorrencia_id,chave_origem) select id,'fixture-1735-posterior' from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0;
 execute 'set local role authenticated';
 h:=pcm.sso_integrar_legado_existente_mediado('16660000-0000-4000-8000-000000000001','17350000-0000-4000-8000-000000000015','16660000-0000-4000-8000-00000000000a',(r->>'preparadaId')::uuid,(select id from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0),'17350000-0000-4000-8000-000000000016','17350000-0000-4000-8000-000000000014','Ciclo conferido');
 if g is distinct from h then raise exception 'replay_apos_avaliacao_divergente';end if;
 begin
  perform pcm.sso_alterar_fila_preventiva_pcm('17350000-0000-4000-8000-000000000019','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',(r->>'preparadaId')::uuid,'incluir',0,'Conferir');
  raise exception 'fila_aceitou_avaliacao_pendente';
 exception when check_violation then if sqlerrm<>'elegibilidade_nao_comprovada' then raise;end if;end;
 execute 'reset role';
 delete from pcm.avaliacoes_preventivas where chave_origem='fixture-1735-posterior';
 execute 'set local role authenticated';
 f:=pcm.sso_alterar_fila_preventiva_pcm('17340000-0000-4000-8000-000000000006','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',(r->>'preparadaId')::uuid,'incluir',0,'Conferir elegibilidade');
 h:=pcm.sso_alterar_fila_preventiva_pcm('17340000-0000-4000-8000-000000000006','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',(r->>'preparadaId')::uuid,'incluir',0,'Conferir elegibilidade');
 if f is distinct from h or f->>'estado'<>'aguardando' then raise exception 'fila_ou_replay_divergente: %',f;end if;
 execute 'reset role';
 insert into pcm.avaliacoes_preventivas(ocorrencia_id,chave_origem) select id,'fixture-1735-depois-fila' from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0;
 execute 'set local role authenticated';
 if (select estado from pcm.sso_consultar_entrada_fila_preventiva('16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',(r->>'preparadaId')::uuid)) is distinct from 'verificacao' then raise exception 'consulta_exibiu_aguardando_obsoleto';end if;
 if (select situacao_atual from pcm.sso_consultar_entrada_fila_preventiva_v2('16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',(r->>'preparadaId')::uuid)) is distinct from 'verificacao' then raise exception 'motivo_verificacao_ausente';end if;
 if (select estado from pcm.sso_listar_fila_preventiva_pcm('16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',null,20)) is distinct from 'verificacao' then raise exception 'listagem_exibiu_aguardando_obsoleto';end if;
 if (select count(*) from pcm.sso_listar_fila_preventiva_cronologica('16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','aguardando',null,null,null,null,20))<>0 then raise exception 'filtro_aguardando_obsoleto';end if;
 if (select count(*) from pcm.sso_listar_fila_preventiva_cronologica('16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','verificacao',null,null,null,null,20))<>1 then raise exception 'filtro_verificacao_ausente';end if;
 begin
  perform pcm.sso_criar_chamado_ciclo_preventivo('17350000-0000-4000-8000-000000000020','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011',(r->>'preparadaId')::uuid);
  raise exception 'chamado_aceitou_avaliacao';
 exception when check_violation then if sqlerrm<>'avaliacao_legada_exige_reconciliacao' then raise;end if;end;

end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_integrar_legado_existente_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text)','execute') then raise exception 'acl_anon_indevida';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16660000-0000-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
 if (select count(*) from pcm.auvo_sync_outbox)<>(select total from baseline_fuso_1666) then raise exception 'outbox_indevido';end if;
end $$;
rollback;
