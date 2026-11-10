-- Executar em transação isolada com migrations até 1642 já carregadas; chamador deve reverter.

set local timezone='UTC';
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16630000-1111-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fixture-166-pmoc@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16630000-1111-4000-8000-000000000001','colaborador','Fixture PMOC',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('16630000-1111-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('16630000-1111-4000-8000-00000000000a','Cliente fixture',true,'16630000-1111-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-1111-4000-8000-000000000001','plano.gerir','16630000-1111-4000-8000-00000000000a'),('16630000-1111-4000-8000-000000000001','cadastro.aprovar','16630000-1111-4000-8000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-00000000000a','Plano fixture','aprovado','16630000-1111-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by) values ('16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000011',1,'aprovado',current_date-1,current_date+365,jsonb_set(jsonb_set('{"fuso_plano":{"fuso":"UTC","vigenciaInicio":"2026-11-01"},"rotinas":[{"id":"16630000-1111-4000-8000-000000000031","rotina_logica_id":"16630000-1111-4000-8000-000000000032","alvo_tipo":"sistema","sistema_id":"16630000-1111-4000-8000-000000000033","modo":"calendario","data_base":"2026-11-04","intervalo_n":1,"intervalo_unidade":"meses","tolerancia_antes":0,"tolerancia_depois":0}]}'::jsonb,'{rotinas,0,data_base}',to_jsonb(current_date::text)),'{fuso_plano,vigenciaInicio}',to_jsonb((current_date-1)::text)),'16630000-1111-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values ('16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-00000000000a','Sistema fixture');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by) values ('16630000-1111-4000-8000-000000000031','16630000-1111-4000-8000-000000000032','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','Rotina fixture','sistema','16630000-1111-4000-8000-000000000033','calendario',1,'meses',current_date,'16630000-1111-4000-8000-000000000001');
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem) values ('16630000-1111-4000-8000-000000000032','sistema','16630000-1111-4000-8000-000000000033','plano');
insert into pcm.pmoc_properties(id,client_id,name,created_by) values ('16630000-1111-4000-8000-000000000041','16630000-1111-4000-8000-00000000000a','Imóvel fixture','16630000-1111-4000-8000-000000000001');
insert into pcm.pmoc_contracts(id,property_id,start_date,end_date,created_by) values ('16630000-1111-4000-8000-000000000042','16630000-1111-4000-8000-000000000041','2026-01-01','2027-12-31','16630000-1111-4000-8000-000000000001');
insert into pcm.pmoc_schedules(id,contract_id,property_id,scheduled_date,maintenance_type,month_ref,year_ref,created_by) values ('16630000-1111-4000-8000-000000000043','16630000-1111-4000-8000-000000000042','16630000-1111-4000-8000-000000000041',current_date,'mensal',extract(month from current_date)::integer,extract(year from current_date)::integer,'16630000-1111-4000-8000-000000000001');
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
do $$ declare v text;begin select pcm.sso_consultar_origem_efetiva_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date)->>'estado' into v;if v is distinct from 'revisao_necessaria' then raise exception 'antes: %',v;end if;end; $$;
select * from pcm.sso_listar_pmoc_ciclo_conferencia('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,null,20);
do $$ begin
 begin perform pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000061','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);raise exception 'materializacao_deveria_ser_bloqueada';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;
end; $$;
select pcm.sso_classificar_pmoc_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000051','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,'16630000-1111-4000-8000-000000000043',0,(select fotografia from pcm.sso_listar_pmoc_ciclo_conferencia('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,null,20)),'documento teste','obrigações distintas','nao_relacionado');
do $$ declare v text;begin select pcm.sso_consultar_origem_efetiva_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date)->>'estado' into v;if v is distinct from 'plano' then raise exception 'apos: %',v;end if;end; $$;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000062','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);
 b:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000062','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);
 if a is distinct from b or a->>'criada' is distinct from 'true' then raise exception 'materializacao_ou_replay_divergente';end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'quantidade_ocorrencias_incorreta';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_nao_deveria_ser_criada';end if;
end; $$;

-- Fixture: a segunda versão e o selo são inseridos artificialmente. Não exercita aprovação real.
set local session_replication_role=replica;
update pcm.plano_versoes set vigencia_fim=current_date-1 where id='16630000-1111-4000-8000-000000000021';
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by)
select '16630000-1111-4000-8000-000000000022',plano_id,2,'aprovado',current_date,current_date+365,
 jsonb_set(jsonb_set(snapshot,'{rotinas,0,id}',to_jsonb('16630000-1111-4000-8000-000000000034'::text)),'{fuso_plano,vigenciaInicio}',to_jsonb(current_date::text)),created_by
from pcm.plano_versoes where id='16630000-1111-4000-8000-000000000021';
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by)
select '16630000-1111-4000-8000-000000000034',rotina_logica_id,plano_id,'16630000-1111-4000-8000-000000000022',nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by from pcm.rotinas_manutencao where id='16630000-1111-4000-8000-000000000031';
insert into pcm.sso_classificacoes_pmoc_revisao(request_id,cliente_id,plano_id,rascunho_id,agendamento_id,revisao_plano,revisao,classificacao,evidencia,motivo,fotografia,ator_id,payload,resultado)
select '16630000-1111-4000-8000-000000000055',cliente_id,plano_id,'16630000-1111-4000-8000-000000000022',agendamento_id,revisao_plano,1,classificacao,evidencia,motivo,fotografia,ator_id,'{}'::jsonb,'{}'::jsonb from pcm.sso_classificacoes_pmoc_revisao where request_id='16630000-1111-4000-8000-000000000051';
set local session_replication_role=origin;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000063','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000034',1,current_date);raise exception 'reutilizacao_sem_selo_aceita';exception when check_violation then if sqlerrm<>'continuidade_ciclo_nao_aprovada' then raise;end if;end;
end; $$;
reset role;
insert into pcm.sso_decisoes_impacto_ocorrencia(request_id,cliente_id,plano_id,rascunho_id,preparada_id,revisao_plano,revisao,decisao,motivo,fotografia,ator_id,payload,resultado)
select '16630000-1111-4000-8000-000000000056','16630000-1111-4000-8000-00000000000a',o.plano_id,'16630000-1111-4000-8000-000000000022',o.id,1,1,'manter_sem_alterar','fixture','{}','16630000-1111-4000-8000-000000000001','{}','{}' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.sso_continuidades_ciclo_aprovadas(cliente_id,plano_id,versao_id,preparada_id,decisao_request_id,vigencia)
select '16630000-1111-4000-8000-00000000000a',o.plano_id,'16630000-1111-4000-8000-000000000022',o.id,'16630000-1111-4000-8000-000000000056',current_date from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000063','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000034',1,current_date);
 if r->>'criada' is distinct from 'false' then raise exception 'ciclo_deveria_ser_reutilizado: %',r;end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'ocorrencia_duplicada';end if;
 if (select count(*) from pcm.sso_ciclo_canonico_usos_versao where versao_id='16630000-1111-4000-8000-000000000022')<>1 then raise exception 'uso_versao_ausente';end if;
end; $$;

-- O ensaio de reuso com selo artificial não libera aprovação real.
do $$ begin
 begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values (txid_current(),'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021',current_date);raise exception 'aprovacao_deveria_ser_bloqueada';exception when check_violation then if sqlerrm<>'aprovacao_bloqueada_impacto_e_fuso_nao_comprovados' then raise;end if;end;
end; $$;
