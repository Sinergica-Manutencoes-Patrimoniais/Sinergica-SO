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
insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,fuso,vigencia_inicio,created_by) values ('16610000-0000-0000-0000-000000000071','16610000-0000-0000-0000-000000000061',1,(current_date + (8-extract(isodow from current_date)::int)),5,1,'08:00',120,'America/Sao_Paulo','2026-10-01','16610000-0000-0000-0000-000000000001');
insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,fuso,vigencia_inicio,created_by) values ('16610000-0000-0000-0000-000000000072','16610000-0000-0000-0000-000000000062',1,(current_date + (8-extract(isodow from current_date)::int)),5,1,'08:00',120,'America/Sao_Paulo','2026-10-01','16610000-0000-0000-0000-000000000001');
insert into pcm.visitas(id,cliente_id,contrato_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('16610000-0000-0000-0000-000000000081','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051',((current_date + (12-extract(isodow from current_date)::int)) + time '11:00') at time zone 'UTC',((current_date + (12-extract(isodow from current_date)::int)) + time '13:00') at time zone 'UTC','America/Sao_Paulo','regular','16610000-0000-0000-0000-000000000001'),
 ('16610000-0000-0000-0000-000000000082','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051',((current_date + (12-extract(isodow from current_date)::int)) + time '11:00') at time zone 'UTC',((current_date + (12-extract(isodow from current_date)::int)) + time '13:00') at time zone 'UTC','America/Sao_Paulo','extra','16610000-0000-0000-0000-000000000001'),
 ('16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051',((current_date + (12-extract(isodow from current_date)::int)) + time '11:00') at time zone 'UTC',((current_date + (12-extract(isodow from current_date)::int)) + time '13:00') at time zone 'UTC','America/Sao_Paulo','regular','16610000-0000-0000-0000-000000000001');
insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) values ('16610000-0000-0000-0000-000000000081','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','16610000-0000-0000-0000-000000000061','16610000-0000-0000-0000-000000000071',(current_date + (8-extract(isodow from current_date)::int)),'16610000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16610000-0000-0000-0000-000000000001','plano.gerir','16610000-0000-0000-0000-00000000000a'),('16610000-0000-0000-0000-000000000001','visita.confirmar','16610000-0000-0000-0000-00000000000a'),('16610000-0000-0000-0000-000000000001','cadastro.aprovar','16610000-0000-0000-0000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values ('16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-00000000000a','Sistema lote');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-00000000000a','Plano lote','aprovado','16610000-0000-0000-0000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,snapshot,created_by) values ('16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000121',1,'aprovado','2026-01-01','{"fuso_plano":{"fuso":"UTC","vigenciaInicio":"2026-01-01"},"rotinas":[{"id":"16610000-0000-0000-0000-000000000123","rotina_logica_id":"16610000-0000-0000-0000-000000000124","nome":"Rotina lote","tolerancia_antes":0,"tolerancia_depois":0,"modo":"visita","intervalo_n":1,"intervalo_unidade":"semanas","alvo_tipo":"sistema","sistema_id":"16610000-0000-0000-0000-000000000120","questionario_id":"16610000-0000-0000-0000-000000000141"}]}'::jsonb,'16610000-0000-0000-0000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,created_by) values ('16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000124','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','Rotina lote','sistema','16610000-0000-0000-0000-000000000120','visita',1,'semanas','16610000-0000-0000-0000-000000000001');
insert into pcm.rotina_visita_serie_vinculos(rotina_logica_id,serie_id,plano_id,criado_por) values ('16610000-0000-0000-0000-000000000124','16610000-0000-0000-0000-000000000061','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000001');
insert into pcm.rotina_serie_vigencias(id,plano_id,rotina_logica_id,serie_id,inicio,criado_por) values ('16610000-0000-0000-0000-000000000125','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000124','16610000-0000-0000-0000-000000000061','2026-01-01','16610000-0000-0000-0000-000000000001');
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem) values ('16610000-0000-0000-0000-000000000124','sistema','16610000-0000-0000-0000-000000000120','plano');
update pcm.ocorrencia_rotina_gate set habilitado=true where id;
update pcm.sso_identidade_ciclo_visita_gate set habilitado=true where id;
update pcm.sso_materializar_visita_canonica_gate set habilitado=true where id;
insert into pcm.pmoc_properties(id,client_id,name,created_by) values ('16610000-0000-0000-0000-000000000150','16610000-0000-0000-0000-00000000000a','Imóvel fixture','16610000-0000-0000-0000-000000000001');
insert into pcm.pmoc_contracts(id,property_id,start_date,end_date,created_by) values ('16610000-0000-0000-0000-000000000151','16610000-0000-0000-0000-000000000150','2026-01-01','2027-12-31','16610000-0000-0000-0000-000000000001');
insert into pcm.pmoc_schedules(id,contract_id,property_id,scheduled_date,maintenance_type,month_ref,year_ref,created_by) values ('16610000-0000-0000-0000-000000000152','16610000-0000-0000-0000-000000000151','16610000-0000-0000-0000-000000000150',(current_date + (12-extract(isodow from current_date)::int)),'mensal',extract(month from (current_date + (12-extract(isodow from current_date)::int)))::int,extract(year from (current_date + (12-extract(isodow from current_date)::int)))::int,'16610000-0000-0000-0000-000000000001');
update pcm.sso_origem_lote_gate set habilitado=true where id;
update pcm.sso_origem_rotina_gate set habilitado=true where id;
update pcm.sso_pmoc_mediado_gate set habilitado=true where id;
update pcm.sso_diagnostico_pmoc_gate set habilitado=true where id;
update pcm.sso_decisao_pmoc_gate set habilitado=true where id;
update pcm.sso_vinculo_ciclo_pmoc_gate set habilitado=true where id;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
set local request.jwt.claims = '{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';

insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('16610000-0000-0000-0000-000000000141',166100141,'Questionário fixture',true);
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values ('16610000-0000-0000-0000-000000000144','Tipo fixture',166100144,'16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000001');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values ('16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-000000000141','16610000-0000-0000-0000-000000000144','Legado fixture',(current_date + (12-extract(isodow from current_date)::int)),'semanas',1,'ativo','16610000-0000-0000-0000-000000000001');
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_vinculo_visita_legado_gate set habilitado=true where id;
update pcm.sso_materializar_visita_legado_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_impacto_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_impacto_mediada_gate set habilitado=true where id;
update pcm.sso_avaliacao_impacto_revisao_gate set habilitado=true where id;
-- Compatibilidade: com continuidade desligada a entrada histórica mantém suas guardas anteriores.
update pcm.sso_continuidade_revisao_gate set habilitado=false where id;
update pcm.sso_ponte_legada_mediada_gate set habilitado=false where id;
set local role authenticated;
do $$ begin begin perform * from pcm.sso_listar_visitas_integracao_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146',null,20);raise exception 'relacao_ausente_aceita';exception when check_violation then if sqlerrm<>'relacao_nao_atual' then raise;end if;end;end; $$;
reset role;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
set local role authenticated;
do $$ begin
 begin perform * from pcm.sso_listar_visitas_integracao_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146',null,20);raise exception 'lista_direta_deveria_bloquear';exception when object_not_in_prerequisite_state then if sqlerrm<>'operacao_desabilitada' then raise;end if;end;
 begin perform pcm.sso_materializar_visita_legado('16610000-0000-0000-0000-000000000147','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000161','16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146','conferido');raise exception 'materializacao_direta_deveria_bloquear';exception when object_not_in_prerequisite_state then if sqlerrm<>'operacao_desabilitada' then raise;end if;end;
 begin perform pcm.sso_materializar_lote_visita_legado('16610000-0000-0000-0000-000000000149','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146','[]'::jsonb,'conferido');raise exception 'lote_direto_deveria_bloquear';exception when object_not_in_prerequisite_state then if sqlerrm<>'operacao_desabilitada' then raise;end if;end;
end; $$;
reset role;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000162','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,(current_date + (12-extract(isodow from current_date)::int)),'16610000-0000-0000-0000-000000000152',0,(select fotografia from pcm.sso_listar_pmoc_ciclo_conferencia('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',1,(current_date + (12-extract(isodow from current_date)::int)),null,20)),'documento','obrigação distinta','nao_relacionado');
select pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000160','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000161','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000081',1,'fonte teste');
select pcm.sso_declarar_relacao_legada_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000146','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145',0,'declarar','relação conferida');
do $$ declare r jsonb;begin
 if (select count(*) from pcm.sso_versoes_legadas_mediadas('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',0,20))<>1 then raise exception 'versao_nao_listada';end if;
 r:=pcm.sso_conferencia_legada_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000145',null,20);
 if r->>'equivalenciaComprovada'<>'false' then raise exception 'conferencia_divergente';end if;
end; $$;
-- Selo/versão sintéticos, não demonstram aprovação real. Apenas clone com rollback.
reset role;
set local session_replication_role=replica;
insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('16610000-0000-0000-0000-000000000241',166100241,'Questionário versão nova',true);
update pcm.plano_versoes set vigencia_fim=current_date-1 where id='16610000-0000-0000-0000-000000000122';
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,snapshot,created_by)
 select '16610000-0000-0000-0000-000000000222',plano_id,2,'aprovado',current_date,
 jsonb_set(jsonb_set(jsonb_set(snapshot,'{rotinas,0,id}',to_jsonb('16610000-0000-0000-0000-000000000223'::text)),'{rotinas,0,questionario_id}',to_jsonb('16610000-0000-0000-0000-000000000241'::text)),'{fuso_plano,vigenciaInicio}',to_jsonb(current_date::text)),created_by
 from pcm.plano_versoes where id='16610000-0000-0000-0000-000000000122';
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,created_by)
 values ('16610000-0000-0000-0000-000000000223','16610000-0000-0000-0000-000000000124','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000222','Rotina versão nova','sistema','16610000-0000-0000-0000-000000000120','visita','16610000-0000-0000-0000-000000000001');
update pcm.planos_preventivos set questionario_id='16610000-0000-0000-0000-000000000241' where id='16610000-0000-0000-0000-000000000145';
insert into pcm.sso_versoes_operacionais_ciclo(tipo,cliente_id,plano_id,preparada_id,versao_id,rotina_id,vigencia,decisao_request_id)
 values ('visita','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','16610000-0000-0000-0000-000000000222','16610000-0000-0000-0000-000000000223',current_date,'16610000-0000-0000-0000-000000000224');
set local session_replication_role=origin;
set local role authenticated;
select pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000225','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000222','16610000-0000-0000-0000-000000000223',1,(current_date + (12-extract(isodow from current_date)::int)),'16610000-0000-0000-0000-000000000152',0,(select fotografia from pcm.sso_listar_pmoc_ciclo_conferencia('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000222','16610000-0000-0000-0000-000000000223',1,(current_date + (12-extract(isodow from current_date)::int)),null,20)),'documento','obrigação distinta na nova versão','nao_relacionado');
reset role;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16610000-0000-0000-0000-000000000001','chamado.os.criar','16610000-0000-0000-0000-00000000000a');
update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,nome}',to_jsonb('Rotina operacional visita'::text),true) where id='16610000-0000-0000-0000-000000000222';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_criar_chamado_ciclo_visita('16610000-0000-0000-0000-000000000911','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161');
 b:=pcm.sso_criar_chamado_ciclo_visita('16610000-0000-0000-0000-000000000911','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161');
 if a is distinct from b or a->>'osCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'chamado_replay_divergente';end if;
end; $$;
reset role;
do $$ declare c uuid;begin
 select chamado_id into c from pcm.sso_chamados_ciclo_visita where plano_id='16610000-0000-0000-0000-000000000121';
 if (select titulo from pcm.chamados where id=c) is distinct from 'Preventiva: Rotina operacional visita' then raise exception 'nome_operacional_incorreto';end if;
 -- INSERT real de OS com gatilhos ativos, pelo owner da fixture.
 insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,origem,created_by,chamado_id)
 values ('16610000-0000-0000-0000-000000000912','16610000-0000-0000-0000-00000000000a','OS-1701-V','OS sintética','preventiva','manual','16610000-0000-0000-0000-000000000001',c);
 if (select versao_id from pcm.sso_origens_os_preventiva where os_id='16610000-0000-0000-0000-000000000912') is distinct from '16610000-0000-0000-0000-000000000222'::uuid then raise exception 'fotografia_incorreta';end if;
 if (select versao_id from pcm.ocorrencias_visita_preparadas where id='16610000-0000-0000-0000-000000000161') is distinct from '16610000-0000-0000-0000-000000000122'::uuid then raise exception 'origem_alterada';end if;
end; $$;
