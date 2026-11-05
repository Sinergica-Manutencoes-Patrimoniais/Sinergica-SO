-- Fixture autocontida com namespace próprio; executar em BEGIN/ROLLBACK.
-- Executar em transação isolada com migrations até 1642 já carregadas; chamador deve reverter.

set local timezone='UTC';
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('17550000-1111-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fixture-1715-pmoc@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17550000-1111-4000-8000-000000000001','colaborador','Fixture PMOC',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17550000-1111-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('17550000-1111-4000-8000-00000000000a','Cliente fixture',true,'17550000-1111-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17550000-1111-4000-8000-000000000001','plano.gerir','17550000-1111-4000-8000-00000000000a'),('17550000-1111-4000-8000-000000000001','cadastro.aprovar','17550000-1111-4000-8000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-00000000000a','Plano fixture','aprovado','17550000-1111-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by) values ('17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000011',1,'aprovado',current_date-1,current_date+365,jsonb_set(jsonb_set('{"fuso_plano":{"fuso":"UTC","vigenciaInicio":"2026-11-01"},"rotinas":[{"id":"17550000-1111-4000-8000-000000000031","rotina_logica_id":"17550000-1111-4000-8000-000000000032","alvo_tipo":"sistema","sistema_id":"17550000-1111-4000-8000-000000000033","nome":"Rotina fixture","modo":"calendario","data_base":"2026-11-04","intervalo_n":1,"intervalo_unidade":"meses","tolerancia_antes":0,"tolerancia_depois":0}]}'::jsonb,'{rotinas,0,data_base}',to_jsonb(current_date::text)),'{fuso_plano,vigenciaInicio}',to_jsonb((current_date-1)::text)),'17550000-1111-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values ('17550000-1111-4000-8000-000000000033','17550000-1111-4000-8000-00000000000a','Sistema fixture');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by) values ('17550000-1111-4000-8000-000000000031','17550000-1111-4000-8000-000000000032','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','Rotina fixture','sistema','17550000-1111-4000-8000-000000000033','calendario',1,'meses',current_date,'17550000-1111-4000-8000-000000000001');
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem) values ('17550000-1111-4000-8000-000000000032','sistema','17550000-1111-4000-8000-000000000033','plano');
insert into pcm.pmoc_properties(id,client_id,name,created_by) values ('17550000-1111-4000-8000-000000000041','17550000-1111-4000-8000-00000000000a','Imóvel fixture','17550000-1111-4000-8000-000000000001');
insert into pcm.pmoc_contracts(id,property_id,start_date,end_date,created_by) values ('17550000-1111-4000-8000-000000000042','17550000-1111-4000-8000-000000000041','2026-01-01','2027-12-31','17550000-1111-4000-8000-000000000001');
insert into pcm.pmoc_schedules(id,contract_id,property_id,scheduled_date,maintenance_type,month_ref,year_ref,created_by) values ('17550000-1111-4000-8000-000000000043','17550000-1111-4000-8000-000000000042','17550000-1111-4000-8000-000000000041',current_date,'mensal',extract(month from current_date)::integer,extract(year from current_date)::integer,'17550000-1111-4000-8000-000000000001');
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
set local request.jwt.claims='{"sub":"17550000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
do $$ declare v text;begin select pcm.sso_consultar_origem_efetiva_ciclo('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date)->>'estado' into v;if v is distinct from 'revisao_necessaria' then raise exception 'antes: %',v;end if;end; $$;
select * from pcm.sso_listar_pmoc_ciclo_conferencia('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date,null,20);
do $$ begin
 begin perform pcm.sso_materializar_ciclo_canonico('17550000-1111-4000-8000-000000000061','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date);raise exception 'materializacao_deveria_ser_bloqueada';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;
end; $$;
select pcm.sso_classificar_pmoc_ciclo('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000051','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date,'17550000-1111-4000-8000-000000000043',0,(select fotografia from pcm.sso_listar_pmoc_ciclo_conferencia('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date,null,20)),'documento teste','obrigações distintas','nao_relacionado');
do $$ declare v text;begin select pcm.sso_consultar_origem_efetiva_ciclo('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date)->>'estado' into v;if v is distinct from 'plano' then raise exception 'apos: %',v;end if;end; $$;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_materializar_ciclo_canonico('17550000-1111-4000-8000-000000000062','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date);
 b:=pcm.sso_materializar_ciclo_canonico('17550000-1111-4000-8000-000000000062','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031',1,current_date);
 if a is distinct from b or a->>'criada' is distinct from 'true' then raise exception 'materializacao_ou_replay_divergente';end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='17550000-1111-4000-8000-000000000011')<>1 then raise exception 'quantidade_ocorrencias_incorreta';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='17550000-1111-4000-8000-00000000000a') then raise exception 'os_nao_deveria_ser_criada';end if;
end; $$;

insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('17550000-1111-4000-8000-000000000095',175500095,'Questionário fixture',true);
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values ('17550000-1111-4000-8000-000000000096','Tipo fixture',175500096,'17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000001');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values ('17550000-1111-4000-8000-000000000097','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000033','17550000-1111-4000-8000-000000000095','17550000-1111-4000-8000-000000000096','Legado fixture',current_date,'meses',1,'ativo','17550000-1111-4000-8000-000000000001');
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,questionario_id}',to_jsonb('17550000-1111-4000-8000-000000000095'::text)) where id='17550000-1111-4000-8000-000000000021';
set local session_replication_role=origin;
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_legado_gate set habilitado=true where id;
update pcm.sso_integrar_ciclo_existente_gate set habilitado=true where id;
update pcm.sso_vinculo_visita_legado_gate set habilitado=true where id;
set local role authenticated;
do $$ begin begin perform * from pcm.sso_planos_legados_mediados('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011',null,20);raise exception 'gate_deveria_bloquear';exception when object_not_in_prerequisite_state then if sqlerrm<>'operacao_desabilitada' then raise;end if;end;end; $$;
reset role;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
set local role authenticated;
do $$ begin begin perform * from pcm.sso_planos_legados_mediados('17550000-1111-4000-8000-000000000002','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011',null,20);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;end; $$;
do $$ declare p uuid;r jsonb;r2 jsonb;begin
 if (select count(*) from pcm.sso_planos_legados_mediados('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011',null,20))<>1 then raise exception 'legado_nao_listado';end if;
 r:=pcm.sso_declarar_relacao_legada_mediada('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000098','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');
 r2:=pcm.sso_declarar_relacao_legada_mediada('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000098','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');
 if r is distinct from r2 then raise exception 'replay_relacao_divergente';end if;
 if (select count(*) from pcm.sso_historico_relacao_legada_mediado('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000097',null,20))<>1 then raise exception 'historico_divergente';end if;
 select preparada_id into p from pcm.sso_ciclos_legados_mediados('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000097','17550000-1111-4000-8000-000000000098',null,20);
 if p is null then raise exception 'ciclo_nao_listado';end if;
 r:=pcm.sso_materializar_legado_mediado('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000099','17550000-1111-4000-8000-00000000000a',p,'17550000-1111-4000-8000-000000000097','17550000-1111-4000-8000-000000000098','17550000-1111-4000-8000-000000000100','Ciclo conferido');
 r2:=pcm.sso_materializar_legado_mediado('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000099','17550000-1111-4000-8000-00000000000a',p,'17550000-1111-4000-8000-000000000097','17550000-1111-4000-8000-000000000098','17550000-1111-4000-8000-000000000100','Ciclo conferido');
 if r is distinct from r2 or r->>'osCriada'<>'false' or r->>'tarefaAuvoCriada'<>'false' then raise exception 'replay_integracao_divergente: %',r;end if;
end; $$;
reset role;
update pcm.sso_decisao_impacto_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_impacto_mediada_gate set habilitado=true where id;
update pcm.sso_avaliacao_impacto_revisao_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_iniciar_revisao_plano('17550000-1111-4000-8000-000000000091',1,'17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000022');
do $$ declare p uuid; r jsonb; r2 jsonb; f jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011',2,null,20);
 if p is null then raise exception 'ocorrencia_nao_listada';end if;
 r:=pcm.sso_decidir_impacto_mediada('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000092','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000022',p,2,0,'manter_sem_alterar','continuidade conferida','calendario');
 r2:=pcm.sso_decidir_impacto_mediada('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000092','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000022',p,2,0,'manter_sem_alterar','continuidade conferida','calendario');
 if r is distinct from r2 or r->>'decisao' is distinct from 'manter_sem_alterar' or r->>'aprovacaoAutorizada' is distinct from 'false' then raise exception 'decisao_ou_replay_divergente: %',r;end if;
 f:=pcm.sso_avaliar_fotografias_grupo_mediada('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011',2);
 if (f->>'ocorrenciasObservadas')::int<>1 or (f->>'fotografiasAusentes')::int<>0 or (f->>'fotografiasObsoletas')::int<>0 or f->>'aprovacaoAutorizada'<>'false' then raise exception 'fotografia_divergente: %',f;end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_decisoes_impacto_ocorrencia where plano_id='17550000-1111-4000-8000-000000000011')<>1 then raise exception 'decisao_duplicada';end if;
 if (select count(*) from pcm.sso_impacto_grupo_fotografias where plano_id='17550000-1111-4000-8000-000000000011')<>1 then raise exception 'fotografia_ausente_ou_duplicada';end if;
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='17550000-1111-4000-8000-000000000011')<>1 then raise exception 'ocorrencia_alterada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='17550000-1111-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;

do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_decisoes_impacto('17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011',2);
 if (r->>'ocorrenciasCalendarioObservadas')::int<>1 or (r->>'decisoesAusentes')::int<>0 or (r->>'decisoesObsoletas')::int<>0 or (r->>'fontesIndividuaisIncompletas')::int<>0 or r->>'aprovacaoAutorizada'<>'false' then raise exception 'avaliacao_legada_divergente: %',r;end if;
end; $$;

do $$ begin
 if has_function_privilege('authenticated','pcm.sso_declarar_relacao_plano_legado(uuid,uuid,uuid,uuid,integer,text,text)','execute') or has_function_privilege('anon','pcm.sso_declarar_relacao_legada_mediada(uuid,uuid,uuid,uuid,uuid,integer,text,text)','execute') then raise exception 'acl_indevida';end if;
end; $$;
update config.sso_concessoes set ativa=false where usuario_id='17550000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ begin begin perform pcm.sso_declarar_relacao_legada_mediada('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-000000000098','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');raise exception 'replay_revogado_aceito';exception when insufficient_privilege then null;end;end; $$;
reset role;

reset role;
update config.sso_concessoes set ativa=true where usuario_id='17550000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_comparacao_datas_legado('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031','17550000-1111-4000-8000-000000000097',current_date,current_date+15);
 if r->>'datasTeoricas'<>'true' or r->>'equivalenciaGeralComprovada'<>'false' or r->>'impactoCalculado'<>'false' or jsonb_array_length(r->'datas')<>1 or r->'datas'->0->>'data'<>current_date::text or r->'datas'->0->>'sso'<>'true' or r->'datas'->0->>'legado'<>'true' then raise exception 'datas_divergentes: %',r;end if;
 begin perform pcm.sso_comparacao_datas_legado('17550000-1111-4000-8000-000000000001','17550000-1111-4000-8000-00000000000a','17550000-1111-4000-8000-000000000011','17550000-1111-4000-8000-000000000021','17550000-1111-4000-8000-000000000031','17550000-1111-4000-8000-000000000097',current_date,current_date+367);raise exception 'janela_invalida_aceita';exception when invalid_parameter_value then null;end;
end; $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_comparacao_datas_legado(uuid,uuid,uuid,uuid,uuid,uuid,date,date)','execute') then raise exception 'acl_anon_indevida';end if;end; $$;
