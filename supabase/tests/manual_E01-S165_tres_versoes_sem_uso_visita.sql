-- APENAS EM CLONE DESCARTÁVEL, migrations 1614–1654.
-- Emula aprovação desativando a guarda 1045 SOMENTE na transação; ROLLBACK restaura.
-- Não autoriza ativação ou deploy; a declaração de fuso é fixture.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_aprovacao_clone' then raise exception 'banco_nao_descartavel';end if;end; $$;
begin;
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
do $$ declare p uuid;a jsonb;b jsonb;begin
 select preparada_id into p from pcm.sso_visitas_legadas_mediadas('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146',null,20);
 if p is null then raise exception 'visita_nao_listada';end if;
 a:=pcm.sso_materializar_visita_legada_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000147','16610000-0000-0000-0000-00000000000a',p,'16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146','conferido');
 b:=pcm.sso_materializar_visita_legada_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000147','16610000-0000-0000-0000-00000000000a',p,'16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146','conferido');
 if a is distinct from b or a->>'osCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'integracao_divergente: %',a;end if;
end; $$;
select pcm.sso_iniciar_revisao_plano('16610000-0000-0000-0000-000000000180',1,'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181');
select pcm.sso_transicionar_revisao_plano('16610000-0000-0000-0000-000000000190',2,'16610000-0000-0000-0000-000000000121','submeter');
do $$ declare r jsonb;begin
 r:=pcm.sso_decidir_impacto_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000182','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',3,0,'manter_sem_alterar','continuidade conferida','visita');
 if r->>'aprovacaoAutorizada'<>'false' then raise exception 'aprovacao_indevida';end if;
end; $$;
reset role;
do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3);
 if (r->>'visitasPreparadasVersaoAnterior')::int<>1 or (r->>'visitasSemPonteLegada')::int<>0 or r->>'aprovacaoAutorizada'<>'false' then raise exception 'avaliacao_divergente: %',r;end if;
 if (select count(*) from pcm.sso_materializacoes_visita_legado where preparada_id='16610000-0000-0000-0000-000000000161')<>1 then raise exception 'vinculo_duplicado';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;

do $$ begin
 if has_function_privilege('anon','pcm.sso_materializar_visita_legada_mediada(uuid,uuid,uuid,uuid,uuid,uuid,text)','execute') then raise exception 'acl_anon_indevida';end if;
end; $$;

reset role;
update pcm.aprovacao_revisao_gate set habilitado=true where id;
update pcm.sso_aprovacao_revisao_mediada_gate set habilitado=true where id;
insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,fonte,motivo,ator_id,payload,resultado) values ('16610000-0000-0000-0000-000000000205','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',1,'UTC','fixture','fixture','16610000-0000-0000-0000-000000000001','{}','{}');
alter table pcm.aprovacao_revisao_tokens disable trigger sso_bloquear_aprovacao_impacto_indeterminado;
set local role authenticated;
select pcm.sso_classificar_pmoc_revisao('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000206','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000152',3,0,'nao_relacionado','documento','obrigações distintas',(select fotografia from pcm.sso_listar_inventario_pmoc_revisao('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3,null,20)));
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000207',3,'16610000-0000-0000-0000-000000000121',current_date+1);
 b:=pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000207',3,'16610000-0000-0000-0000-000000000121',current_date+1);
 if a is distinct from b or a->>'state'<>'aprovado' then raise exception 'aprovacao_visita_divergente';end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_continuidades_visita_aprovadas where versao_id='16610000-0000-0000-0000-000000000181')<>1 then raise exception 'selo_segunda_versao_ausente';end if;
 if exists(select 1 from pcm.sso_ciclo_visita_usos_versao where versao_id='16610000-0000-0000-0000-000000000181') then raise exception 'fixture_ja_rematerializada';end if;
end; $$;
set local role authenticated;
select pcm.sso_iniciar_revisao_plano('16610000-0000-0000-0000-000000000301',4,'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000302');
select pcm.sso_transicionar_revisao_plano('16610000-0000-0000-0000-000000000303',5,'16610000-0000-0000-0000-000000000121','submeter');
do $$ declare p uuid;n integer;r jsonb;begin
 select count(*),min(preparada_id::text)::uuid into n,p from pcm.sso_listar_decisoes_visita_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',6,null,20);
 if n<>1 or p is null then raise exception 'continuidade_visita_nao_listada_ou_duplicada: %',n;end if;
 r:=pcm.sso_decidir_impacto_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000304','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000302',p,6,0,'manter_sem_alterar','revisão seguinte conferida','visita');
 if r->>'decisao'<>'manter_sem_alterar' then raise exception 'decisao_nao_registrada';end if;
end; $$;
-- O mesmo selo mais uso não pode duplicar a obrigação. Depois removemos o uso sintético.
savepoint com_uso;
reset role;
insert into pcm.sso_ciclo_visita_usos_versao(ciclo_id,versao_id,rotina_id,preparada_id,ator_id)
select cv.ciclo_id,'16610000-0000-0000-0000-000000000181',r.id,o.id,'16610000-0000-0000-0000-000000000001'
from pcm.ocorrencias_visita_preparadas o join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=o.id
join pcm.rotinas_manutencao r on r.versao_id='16610000-0000-0000-0000-000000000181' and r.rotina_logica_id=o.rotina_logica_id
where o.id='16610000-0000-0000-0000-000000000161';
set local role authenticated;
do $$ declare n integer;begin select count(*) into n from pcm.sso_listar_decisoes_visita_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',6,null,20);if n<>1 then raise exception 'duplicacao_selo_e_uso: %',n;end if;end; $$;
rollback to savepoint com_uso;
select pcm.sso_classificar_pmoc_revisao('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000305','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000302','16610000-0000-0000-0000-000000000152',6,0,'nao_relacionado','documento','obrigações distintas',(select fotografia from pcm.sso_listar_inventario_pmoc_revisao('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',6,null,20)));
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000306',6,'16610000-0000-0000-0000-000000000121',current_date+2);
 b:=pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000306',6,'16610000-0000-0000-0000-000000000121',current_date+2);
 if a is distinct from b or a->>'state'<>'aprovado' then raise exception 'replay_terceira_versao_divergente';end if;
end; $$;
reset role;
select set_config('sso.fixture.rotina',(select id::text from pcm.rotinas_manutencao where versao_id='16610000-0000-0000-0000-000000000302'),true);
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000401','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000402','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000302',current_setting('sso.fixture.rotina')::uuid,'16610000-0000-0000-0000-000000000081',7,'fonte teste'); b:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000401','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000402','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000302',current_setting('sso.fixture.rotina')::uuid,'16610000-0000-0000-0000-000000000081',7,'fonte teste');
 if a is distinct from b or a->>'criada' is distinct from 'false' then raise exception 'reuso_terceira_versao_divergente: %',a;end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_continuidades_visita_aprovadas where versao_id='16610000-0000-0000-0000-000000000302')<>1 then raise exception 'selo_terceira_versao_ausente_ou_duplicado';end if;
 if (select count(*) from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121')<>1 then raise exception 'visita_duplicada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
 if (select count(*) from pcm.auvo_sync_outbox)<>(select outbox from baseline_pmoc_visita) then raise exception 'envio_auvo_indevido';end if;
 if (select count(*) from pcm.sso_ciclo_visita_usos_versao where versao_id='16610000-0000-0000-0000-000000000302')<>1 then raise exception 'uso_terceira_versao_ausente_ou_duplicado';end if;
end; $$;
rollback;
