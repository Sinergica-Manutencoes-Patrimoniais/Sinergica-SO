-- APENAS EM CLONE DESCARTÁVEL: migrations 1614–1653 já carregadas.
-- Desliga o trigger 1045 e concede ACL SOMENTE na transação sintética; ROLLBACK restaura ambos.
-- Não prova segurança de aprovação integral nem autoriza ativação/deploy.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_aprovacao_clone' then raise exception 'banco_nao_descartavel';end if;end; $$;
begin;
-- Executar em transação isolada com migrations até 1642 já carregadas; chamador deve reverter.

set local timezone='UTC';
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16630000-1111-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fixture-166-pmoc@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16630000-1111-4000-8000-000000000001','colaborador','Fixture PMOC',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('16630000-1111-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('16630000-1111-4000-8000-00000000000a','Cliente fixture',true,'16630000-1111-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-1111-4000-8000-000000000001','plano.gerir','16630000-1111-4000-8000-00000000000a'),('16630000-1111-4000-8000-000000000001','cadastro.aprovar','16630000-1111-4000-8000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-00000000000a','Plano fixture','aprovado','16630000-1111-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by) values ('16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000011',1,'aprovado',current_date-1,null,jsonb_set(jsonb_set('{"fuso_plano":{"fuso":"UTC","vigenciaInicio":"2026-11-01"},"rotinas":[{"id":"16630000-1111-4000-8000-000000000031","rotina_logica_id":"16630000-1111-4000-8000-000000000032","alvo_tipo":"sistema","sistema_id":"16630000-1111-4000-8000-000000000033","nome":"Rotina fixture","modo":"calendario","data_base":"2026-11-04","intervalo_n":1,"intervalo_unidade":"meses","tolerancia_antes":0,"tolerancia_depois":0}]}'::jsonb,'{rotinas,0,data_base}',to_jsonb((current_date+30)::text)),'{fuso_plano,vigenciaInicio}',to_jsonb((current_date-1)::text)),'16630000-1111-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values ('16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-00000000000a','Sistema fixture');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by) values ('16630000-1111-4000-8000-000000000031','16630000-1111-4000-8000-000000000032','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','Rotina fixture','sistema','16630000-1111-4000-8000-000000000033','calendario',1,'meses',(current_date+30),'16630000-1111-4000-8000-000000000001');
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem) values ('16630000-1111-4000-8000-000000000032','sistema','16630000-1111-4000-8000-000000000033','plano');
insert into pcm.pmoc_properties(id,client_id,name,created_by) values ('16630000-1111-4000-8000-000000000041','16630000-1111-4000-8000-00000000000a','Imóvel fixture','16630000-1111-4000-8000-000000000001');
insert into pcm.pmoc_contracts(id,property_id,start_date,end_date,created_by) values ('16630000-1111-4000-8000-000000000042','16630000-1111-4000-8000-000000000041','2026-01-01','2027-12-31','16630000-1111-4000-8000-000000000001');
insert into pcm.pmoc_schedules(id,contract_id,property_id,scheduled_date,maintenance_type,month_ref,year_ref,created_by) values ('16630000-1111-4000-8000-000000000043','16630000-1111-4000-8000-000000000042','16630000-1111-4000-8000-000000000041',(current_date+30),'mensal',extract(month from (current_date+30))::integer,extract(year from (current_date+30))::integer,'16630000-1111-4000-8000-000000000001');
update pcm.sso_origem_lote_gate set habilitado=true where id;
update pcm.sso_origem_rotina_gate set habilitado=true where id;
update pcm.sso_pmoc_mediado_gate set habilitado=true where id;
update pcm.sso_diagnostico_pmoc_gate set habilitado=true where id;
update pcm.sso_decisao_pmoc_gate set habilitado=true where id;
update pcm.sso_vinculo_ciclo_pmoc_gate set habilitado=true where id;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_identidade_ciclo_gate set habilitado=true where id;
update pcm.ocorrencia_rotina_gate set habilitado=true where id;
update pcm.sso_guarda_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
do $$ declare v text;begin select pcm.sso_consultar_origem_efetiva_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30))->>'estado' into v;if v is distinct from 'revisao_necessaria' then raise exception 'antes: %',v;end if;end; $$;
select * from pcm.sso_listar_pmoc_ciclo_conferencia('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30),null,20);
do $$ begin
 begin perform pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000061','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30));raise exception 'materializacao_deveria_ser_bloqueada';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;
end; $$;
select pcm.sso_classificar_pmoc_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000051','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30),'16630000-1111-4000-8000-000000000043',0,(select fotografia from pcm.sso_listar_pmoc_ciclo_conferencia('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30),null,20)),'documento teste','obrigações distintas','nao_relacionado');
do $$ declare v text;begin select pcm.sso_consultar_origem_efetiva_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30))->>'estado' into v;if v is distinct from 'plano' then raise exception 'apos: %',v;end if;end; $$;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000062','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30));
 b:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000062','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,(current_date+30));
 if a is distinct from b or a->>'criada' is distinct from 'true' then raise exception 'materializacao_ou_replay_divergente';end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'quantidade_ocorrencias_incorreta';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_nao_deveria_ser_criada';end if;
end; $$;

insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('16630000-1111-4000-8000-000000000095',166300095,'Questionário fixture',true);
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values ('16630000-1111-4000-8000-000000000096','Tipo fixture',166300096,'16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000001');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values ('16630000-1111-4000-8000-000000000097','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-000000000095','16630000-1111-4000-8000-000000000096','Legado fixture',(current_date+30),'meses',1,'ativo','16630000-1111-4000-8000-000000000001');
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,questionario_id}',to_jsonb('16630000-1111-4000-8000-000000000095'::text)) where id='16630000-1111-4000-8000-000000000021';
set local session_replication_role=origin;
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_legado_gate set habilitado=true where id;
update pcm.sso_integrar_ciclo_existente_gate set habilitado=true where id;
update pcm.sso_vinculo_visita_legado_gate set habilitado=true where id;
set local role authenticated;
do $$ begin begin perform * from pcm.sso_planos_legados_mediados('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',null,20);raise exception 'gate_deveria_bloquear';exception when object_not_in_prerequisite_state then if sqlerrm<>'operacao_desabilitada' then raise;end if;end;end; $$;
reset role;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
set local role authenticated;
do $$ begin begin perform * from pcm.sso_planos_legados_mediados('16630000-1111-4000-8000-000000000002','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',null,20);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;end; $$;
do $$ declare p uuid;r jsonb;r2 jsonb;begin
 if (select count(*) from pcm.sso_planos_legados_mediados('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',null,20))<>1 then raise exception 'legado_nao_listado';end if;
 r:=pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');
 r2:=pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');
 if r is distinct from r2 then raise exception 'replay_relacao_divergente';end if;
 if (select count(*) from pcm.sso_historico_relacao_legada_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',null,20))<>1 then raise exception 'historico_divergente';end if;
 select preparada_id into p from pcm.sso_ciclos_legados_mediados('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097','16630000-1111-4000-8000-000000000098',null,20);
 if p is null then raise exception 'ciclo_nao_listado';end if;
 r:=pcm.sso_materializar_legado_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000099','16630000-1111-4000-8000-00000000000a',p,'16630000-1111-4000-8000-000000000097','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-000000000100','Ciclo conferido');
 r2:=pcm.sso_materializar_legado_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000099','16630000-1111-4000-8000-00000000000a',p,'16630000-1111-4000-8000-000000000097','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-000000000100','Ciclo conferido');
 if r is distinct from r2 or r->>'osCriada'<>'false' or r->>'tarefaAuvoCriada'<>'false' then raise exception 'replay_integracao_divergente: %',r;end if;
end; $$;
reset role;
update pcm.sso_decisao_impacto_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_impacto_mediada_gate set habilitado=true where id;
update pcm.sso_avaliacao_impacto_revisao_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_iniciar_revisao_plano('16630000-1111-4000-8000-000000000091',1,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022');
select pcm.sso_transicionar_revisao_plano('16630000-1111-4000-8000-000000000202',2,'16630000-1111-4000-8000-000000000011','submeter');
do $$ declare p uuid; r jsonb; r2 jsonb; f jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,null,20);
 if p is null then raise exception 'ocorrencia_nao_listada';end if;
 r:=pcm.sso_decidir_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000092','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,0,'manter_sem_alterar','continuidade conferida','calendario');
 r2:=pcm.sso_decidir_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000092','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,0,'manter_sem_alterar','continuidade conferida','calendario');
 if r is distinct from r2 or r->>'decisao' is distinct from 'manter_sem_alterar' or r->>'aprovacaoAutorizada' is distinct from 'false' then raise exception 'decisao_ou_replay_divergente: %',r;end if;
 f:=pcm.sso_avaliar_fotografias_grupo_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3);
 if (f->>'ocorrenciasObservadas')::int<>1 or (f->>'fotografiasAusentes')::int<>0 or (f->>'fotografiasObsoletas')::int<>0 or f->>'aprovacaoAutorizada'<>'false' then raise exception 'fotografia_divergente: %',f;end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_decisoes_impacto_ocorrencia where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'decisao_duplicada';end if;
 if (select count(*) from pcm.sso_impacto_grupo_fotografias where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'fotografia_ausente_ou_duplicada';end if;
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'ocorrencia_alterada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;

do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_decisoes_impacto('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3);
 if (r->>'ocorrenciasCalendarioObservadas')::int<>1 or (r->>'decisoesAusentes')::int<>0 or (r->>'decisoesObsoletas')::int<>0 or (r->>'fontesIndividuaisIncompletas')::int<>0 or r->>'aprovacaoAutorizada'<>'false' then raise exception 'avaliacao_legada_divergente: %',r;end if;
end; $$;

do $$ begin
 if has_function_privilege('authenticated','pcm.sso_declarar_relacao_plano_legado(uuid,uuid,uuid,uuid,integer,text,text)','execute') or has_function_privilege('anon','pcm.sso_declarar_relacao_legada_mediada(uuid,uuid,uuid,uuid,uuid,integer,text,text)','execute') then raise exception 'acl_indevida';end if;
end; $$;
update config.sso_concessoes set ativa=false where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ begin begin perform pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');raise exception 'replay_revogado_aceito';exception when insufficient_privilege then null;end;end; $$;
reset role;

reset role;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.aprovacao_revisao_gate set habilitado=true where id;
insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,fonte,motivo,ator_id,payload,resultado) values ('16630000-1111-4000-8000-000000000204','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,'UTC','fixture','fixture','16630000-1111-4000-8000-000000000001','{}','{}');
-- O bloqueio independente e desligado apenas nesta transacao sintetica; nenhuma migration de producao e modificada.
alter table pcm.aprovacao_revisao_tokens disable trigger sso_bloquear_aprovacao_impacto_indeterminado;
grant execute on function pcm.sso_aprovar_revisao_preparada(uuid,integer,uuid,date) to authenticated;
set local role authenticated;
select pcm.sso_classificar_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000203','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000043',3,0,'nao_relacionado','documento','obrigação distinta',(select fotografia from pcm.sso_listar_inventario_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,null,20)));
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_revisao_preparada('16630000-1111-4000-8000-000000000201',3,'16630000-1111-4000-8000-000000000011',current_date+1);
 b:=pcm.sso_aprovar_revisao_preparada('16630000-1111-4000-8000-000000000201',3,'16630000-1111-4000-8000-000000000011',current_date+1);
 if a is distinct from b or a->>'state'<>'aprovado' then raise exception 'replay_aprovacao_divergente: % %',a,b;end if;
end; $$;
reset role;
do $$ begin
 if (select estado from pcm.plano_versoes where id='16630000-1111-4000-8000-000000000022')<>'aprovado' then raise exception 'versao_nao_aprovada';end if;
 if (select vigencia_fim from pcm.plano_versoes where id='16630000-1111-4000-8000-000000000021') is distinct from current_date then raise exception 'vigencia_anterior_divergente';end if;
 if (select count(*) from pcm.sso_continuidades_ciclo_aprovadas where versao_id='16630000-1111-4000-8000-000000000022')<>1 then raise exception 'selo_ausente_ou_duplicado';end if;
 if (select snapshot->'fuso_plano'->>'fuso' from pcm.plano_versoes where id='16630000-1111-4000-8000-000000000022')<>'UTC' then raise exception 'fuso_nao_congelado';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;

-- A segunda versão foi aprovada, mas o gerador nunca a rematerializou.
do $$ begin
 if exists(select 1 from pcm.sso_ciclo_canonico_usos_versao where versao_id='16630000-1111-4000-8000-000000000022') then raise exception 'fixture_ja_rematerializada';end if;
end; $$;
set local role authenticated;
select pcm.sso_iniciar_revisao_plano('16630000-1111-4000-8000-000000000301',4,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000302');
select pcm.sso_transicionar_revisao_plano('16630000-1111-4000-8000-000000000303',5,'16630000-1111-4000-8000-000000000011','submeter');
do $$ declare p uuid;n integer;r jsonb;begin
 select count(*),min(preparada_id::text)::uuid into n,p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',6,null,20);
 if n<>1 or p is null then raise exception 'continuidade_nao_listada_ou_duplicada: %',n;end if;
 r:=pcm.sso_decidir_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000304','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000302',p,6,0,'manter_sem_alterar','revisão seguinte conferida','calendario');
 if r->>'decisao'<>'manter_sem_alterar' then raise exception 'decisao_nao_registrada';end if;
end; $$;
-- O mesmo selo mais uso não pode duplicar a obrigação. Depois removemos o uso sintético.
savepoint com_uso;
reset role;
insert into pcm.sso_ciclo_canonico_usos_versao(ciclo_id,versao_id,rotina_id,preparada_id,ator_id)
select cv.ciclo_id,'16630000-1111-4000-8000-000000000022',r.id,o.id,'16630000-1111-4000-8000-000000000001'
from pcm.ocorrencias_rotina_preparadas o join pcm.sso_ciclo_calendario_versoes cv on cv.preparada_id=o.id
join pcm.rotinas_manutencao r on r.versao_id='16630000-1111-4000-8000-000000000022' and r.rotina_logica_id=o.rotina_logica_id
where o.plano_id='16630000-1111-4000-8000-000000000011';
set local role authenticated;
do $$ declare n integer;begin select count(*) into n from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',6,null,20);if n<>1 then raise exception 'duplicacao_selo_e_uso: %',n;end if;end; $$;
rollback to savepoint com_uso;
select pcm.sso_classificar_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000305','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000302','16630000-1111-4000-8000-000000000043',6,0,'nao_relacionado','documento','obrigação distinta',(select fotografia from pcm.sso_listar_inventario_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',6,null,20)));
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_revisao_preparada('16630000-1111-4000-8000-000000000306',6,'16630000-1111-4000-8000-000000000011',current_date+2);
 b:=pcm.sso_aprovar_revisao_preparada('16630000-1111-4000-8000-000000000306',6,'16630000-1111-4000-8000-000000000011',current_date+2);
 if a is distinct from b or a->>'state'<>'aprovado' then raise exception 'replay_terceira_versao_divergente';end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_continuidades_ciclo_aprovadas where versao_id='16630000-1111-4000-8000-000000000302')<>1 then raise exception 'selo_terceira_versao_ausente_ou_duplicado';end if;
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'ocorrencia_duplicada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;
rollback;
