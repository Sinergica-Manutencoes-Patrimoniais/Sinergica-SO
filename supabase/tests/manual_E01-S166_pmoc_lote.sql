-- Executar em transação isolada com migrations até 1642 já carregadas; chamador deve reverter.

set local timezone='UTC';
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16630000-1111-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fixture-166-pmoc@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16630000-1111-4000-8000-000000000001','colaborador','Fixture PMOC',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('16630000-1111-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('16630000-1111-4000-8000-00000000000a','Cliente fixture',true,'16630000-1111-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-1111-4000-8000-000000000001','plano.gerir','16630000-1111-4000-8000-00000000000a'),('16630000-1111-4000-8000-000000000001','cadastro.aprovar','16630000-1111-4000-8000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-00000000000a','Plano fixture','aprovado','16630000-1111-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by) values ('16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000011',1,'aprovado',current_date-1,current_date+365,jsonb_set(jsonb_set('{"fuso_plano":{"fuso":"UTC","vigenciaInicio":"2026-11-01"},"rotinas":[{"id":"16630000-1111-4000-8000-000000000031","rotina_logica_id":"16630000-1111-4000-8000-000000000032","alvo_tipo":"sistema","sistema_id":"16630000-1111-4000-8000-000000000033","modo":"calendario","data_base":"2026-11-04","intervalo_n":1,"intervalo_unidade":"dias","tolerancia_antes":0,"tolerancia_depois":0}]}'::jsonb,'{rotinas,0,data_base}',to_jsonb(current_date::text)),'{fuso_plano,vigenciaInicio}',to_jsonb((current_date-1)::text)),'16630000-1111-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values ('16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-00000000000a','Sistema fixture');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by) values ('16630000-1111-4000-8000-000000000031','16630000-1111-4000-8000-000000000032','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','Rotina fixture','sistema','16630000-1111-4000-8000-000000000033','calendario',1,'dias',current_date,'16630000-1111-4000-8000-000000000001');
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem) values ('16630000-1111-4000-8000-000000000032','sistema','16630000-1111-4000-8000-000000000033','plano');
insert into pcm.pmoc_properties(id,client_id,name,created_by) values ('16630000-1111-4000-8000-000000000041','16630000-1111-4000-8000-00000000000a','Imóvel fixture','16630000-1111-4000-8000-000000000001');
insert into pcm.pmoc_contracts(id,property_id,start_date,end_date,created_by) values ('16630000-1111-4000-8000-000000000042','16630000-1111-4000-8000-000000000041','2026-01-01','2027-12-31','16630000-1111-4000-8000-000000000001');
insert into pcm.pmoc_schedules(id,contract_id,property_id,scheduled_date,maintenance_type,month_ref,year_ref,created_by) values ('16630000-1111-4000-8000-000000000043','16630000-1111-4000-8000-000000000042','16630000-1111-4000-8000-000000000041',current_date+1,'mensal',extract(month from current_date)::integer,extract(year from current_date)::integer,'16630000-1111-4000-8000-000000000001');
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
update pcm.sso_lote_ciclos_calendario_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
do $$ begin
 begin perform pcm.sso_materializar_lote_calendario('16630000-1111-4000-8000-000000000071','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date+1);raise exception 'lote_deveria_ser_bloqueado';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;
end; $$;
reset role;
do $$ begin if exists(select 1 from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011') then raise exception 'rollback_parcial_falhou';end if;end; $$;
set local role authenticated;
select pcm.sso_classificar_pmoc_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000051','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date+1,'16630000-1111-4000-8000-000000000043',0,(select fotografia from pcm.sso_listar_pmoc_ciclo_conferencia('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date+1,null,20)),'documento teste','obrigações distintas','nao_relacionado');
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_materializar_lote_calendario('16630000-1111-4000-8000-000000000071','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date+1);b:=pcm.sso_materializar_lote_calendario('16630000-1111-4000-8000-000000000071','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date+1);
 if a is distinct from b or (a->>'total')::int<>2 or (a->>'criadas')::int<>2 or a->>'atomico'<>'true' then raise exception 'lote_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>2 then raise exception 'quantidade_incorreta';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_nao_deveria_ser_criada';end if;
end; $$;

update pcm.pmoc_schedules set status='atrasado' where id='16630000-1111-4000-8000-000000000043';
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_materializar_lote_calendario('16630000-1111-4000-8000-000000000071','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date,current_date+1);
 if (r->>'total')::int<>2 or (r->>'criadas')::int<>2 then raise exception 'replay_lote_divergente';end if;
end; $$;
reset role;
