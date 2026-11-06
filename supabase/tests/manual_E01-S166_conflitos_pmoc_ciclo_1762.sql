-- Executar em transação isolada com migrations até 1642; chamador deve reverter.
set local app.auvo_sync_write='true';
create temporary table baseline_pmoc_visita as select (select count(*) from pcm.auvo_sync_outbox) as outbox;
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16610000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','origem-s166@test.local',crypt('x', gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16610000-0000-0000-0000-000000000001','superadmin','Origem S166',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('16610000-0000-0000-0000-00000000000a','Origem A',true,'16610000-0000-0000-0000-000000000001'),
 ('16610000-0000-0000-0000-00000000000b','Origem B',true,'16610000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor) values ('16610000-0000-0000-0000-000000000021','Origem S166',1,'#000');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('16610000-0000-0000-0000-000000000031','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000021','Origem S166');
insert into comercial.propostas(id,oportunidade_id,tipo) values ('16610000-0000-0000-0000-000000000041','16610000-0000-0000-0000-000000000031','volante');
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio) values ('16610000-0000-0000-0000-000000000051','16610000-0000-0000-0000-000000000041','16610000-0000-0000-0000-00000000000a','volante','2026-01-01');
insert into pcm.calendario_contratual_series(id,cliente_id,contrato_id,created_by) values ('16610000-0000-0000-0000-000000000061','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','16610000-0000-0000-0000-000000000001');
insert into pcm.calendario_contratual_series(id,cliente_id,contrato_id,created_by) values ('16610000-0000-0000-0000-000000000062','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','16610000-0000-0000-0000-000000000001');
insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,fuso,vigencia_inicio,created_by) values ('16610000-0000-0000-0000-000000000071','16610000-0000-0000-0000-000000000061',1,'2026-10-05',5,1,'08:00',120,'America/Sao_Paulo','2026-10-01','16610000-0000-0000-0000-000000000001');
insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,fuso,vigencia_inicio,created_by) values ('16610000-0000-0000-0000-000000000072','16610000-0000-0000-0000-000000000062',1,'2026-10-05',5,1,'08:00',120,'America/Sao_Paulo','2026-10-01','16610000-0000-0000-0000-000000000001');
insert into pcm.visitas(id,cliente_id,contrato_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('16610000-0000-0000-0000-000000000081','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','2026-10-09 11:00+00','2026-10-09 13:00+00','America/Sao_Paulo','regular','16610000-0000-0000-0000-000000000001'),
 ('16610000-0000-0000-0000-000000000082','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','2026-10-09 11:00+00','2026-10-09 13:00+00','America/Sao_Paulo','extra','16610000-0000-0000-0000-000000000001'),
 ('16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','2026-10-09 11:00+00','2026-10-09 13:00+00','America/Sao_Paulo','regular','16610000-0000-0000-0000-000000000001');
insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) values ('16610000-0000-0000-0000-000000000081','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','16610000-0000-0000-0000-000000000061','16610000-0000-0000-0000-000000000071','2026-10-05','16610000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16610000-0000-0000-0000-000000000001','plano.gerir','16610000-0000-0000-0000-00000000000a'),('16610000-0000-0000-0000-000000000001','visita.confirmar','16610000-0000-0000-0000-00000000000a'),('16610000-0000-0000-0000-000000000001','cadastro.aprovar','16610000-0000-0000-0000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values ('16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-00000000000a','Sistema lote');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-00000000000a','Plano lote','aprovado','16610000-0000-0000-0000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,snapshot,created_by) values ('16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000121',1,'aprovado','2026-01-01','{"fuso_plano":{"fuso":"UTC","vigenciaInicio":"2026-01-01"},"rotinas":[{"id":"16610000-0000-0000-0000-000000000123","rotina_logica_id":"16610000-0000-0000-0000-000000000124","modo":"visita","intervalo_n":1,"intervalo_unidade":"semanas","alvo_tipo":"sistema","sistema_id":"16610000-0000-0000-0000-000000000120","questionario_id":"16610000-0000-0000-0000-000000000141"}]}'::jsonb,'16610000-0000-0000-0000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,created_by) values ('16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000124','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','Rotina lote','sistema','16610000-0000-0000-0000-000000000120','visita',1,'semanas','16610000-0000-0000-0000-000000000001');
insert into pcm.rotina_visita_serie_vinculos(rotina_logica_id,serie_id,plano_id,criado_por) values ('16610000-0000-0000-0000-000000000124','16610000-0000-0000-0000-000000000061','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000001');
insert into pcm.rotina_serie_vigencias(id,plano_id,rotina_logica_id,serie_id,inicio,criado_por) values ('16610000-0000-0000-0000-000000000125','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000124','16610000-0000-0000-0000-000000000061','2026-01-01','16610000-0000-0000-0000-000000000001');
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem) values ('16610000-0000-0000-0000-000000000124','sistema','16610000-0000-0000-0000-000000000120','plano');
update pcm.ocorrencia_rotina_gate set habilitado=true where id;
update pcm.sso_identidade_ciclo_visita_gate set habilitado=true where id;
update pcm.sso_materializar_visita_canonica_gate set habilitado=true where id;
insert into pcm.pmoc_properties(id,client_id,name,created_by) values ('16610000-0000-0000-0000-000000000150','16610000-0000-0000-0000-00000000000a','Imóvel fixture','16610000-0000-0000-0000-000000000001');
insert into pcm.pmoc_contracts(id,property_id,start_date,end_date,created_by) values ('16610000-0000-0000-0000-000000000151','16610000-0000-0000-0000-000000000150','2026-01-01','2027-12-31','16610000-0000-0000-0000-000000000001');
insert into pcm.pmoc_schedules(id,contract_id,property_id,scheduled_date,maintenance_type,month_ref,year_ref,created_by) values ('16610000-0000-0000-0000-000000000152','16610000-0000-0000-0000-000000000151','16610000-0000-0000-0000-000000000150','2026-10-09','mensal',10,2026,'16610000-0000-0000-0000-000000000001');
update pcm.sso_origem_lote_gate set habilitado=true where id;
update pcm.sso_origem_rotina_gate set habilitado=true where id;
update pcm.sso_pmoc_mediado_gate set habilitado=true where id;
update pcm.sso_diagnostico_pmoc_gate set habilitado=true where id;
update pcm.sso_decisao_pmoc_gate set habilitado=true where id;
update pcm.sso_vinculo_ciclo_pmoc_gate set habilitado=true where id;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
set local request.jwt.claims = '{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$ begin begin perform pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000160','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000161','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000081',1,'fonte de teste');raise exception 'visita_deveria_bloquear';exception when check_violation then if sqlerrm<>'pmoc_mesma_data_exige_conferencia' then raise;end if;end;end; $$;
reset role;
update config.sso_concessoes set ativa=false where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
set local role authenticated;
do $$ begin begin perform * from pcm.sso_listar_pmoc_ciclo_conferencia('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,'2026-10-09',null,20);raise exception 'consulta_sem_permissao_aceita';exception when insufficient_privilege then null;end;end; $$;
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
set local role authenticated;
do $$ declare f jsonb;a jsonb;b jsonb;begin
 select fotografia into f from pcm.sso_listar_pmoc_ciclo_conferencia('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,'2026-10-09',null,20);
 begin perform pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000162','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',2,'2026-10-09','16610000-0000-0000-0000-000000000152',0,f,'fonte teste','distinta','nao_relacionado');raise exception 'revisao_aceita';exception when sqlstate 'P0011' then null;end;
 begin perform pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000162','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,'2026-10-09','16610000-0000-0000-0000-000000000152',0,f||'{"tipo":"alterado"}'::jsonb,'fonte teste','distinta','nao_relacionado');raise exception 'foto_aceita';exception when sqlstate 'P0013' then null;end;
 begin perform pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000162','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,'2026-10-09','16610000-0000-0000-0000-000000000152',1,f,'fonte teste','distinta','nao_relacionado');raise exception 'decisao_aceita';exception when sqlstate 'P0014' then null;end;
 a:=pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000162','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,'2026-10-09','16610000-0000-0000-0000-000000000152',0,f,'fonte teste','distinta','nao_relacionado');
 b:=pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000162','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,'2026-10-09','16610000-0000-0000-0000-000000000152',0,f,'fonte teste','distinta','nao_relacionado');if a is distinct from b then raise exception 'replay_divergente';end if;
end $$;
