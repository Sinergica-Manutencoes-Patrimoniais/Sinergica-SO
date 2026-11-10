-- Executar em clone descartável com migrations até 1666; chamador inicia e reverte a transação.
set local app.auvo_sync_write='true';
create temporary table baseline_fuso_1666 as select count(*) total from pcm.auvo_sync_outbox;
select set_config('sso.fixture.fuso',case when (transaction_timestamp() at time zone 'Pacific/Kiritimati')::date<>(transaction_timestamp() at time zone 'America/Sao_Paulo')::date then 'Pacific/Kiritimati' else 'Etc/GMT+12' end,true);
select set_config('sso.fixture.hoje',(transaction_timestamp() at time zone current_setting('sso.fixture.fuso'))::date::text,true);
select set_config('sso.fixture.sp',(transaction_timestamp() at time zone 'America/Sao_Paulo')::date::text,true);
do $$ begin if current_setting('sso.fixture.hoje')=current_setting('sso.fixture.sp') then raise exception 'fixture_fusos_nao_divergem';end if;end; $$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16660000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fuso-1666@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16660000-0000-4000-8000-000000000001','colaborador','Fixture fuso',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('16660000-0000-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('16660000-0000-4000-8000-00000000000a','Cliente fuso',true,'16660000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16660000-0000-4000-8000-000000000001','plano.gerir','16660000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values ('16660000-0000-4000-8000-000000000033','16660000-0000-4000-8000-00000000000a','Sistema fuso');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-00000000000a','Plano fuso','aprovado','16660000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,snapshot,created_by)
values ('16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000011',1,'aprovado',current_setting('sso.fixture.hoje')::date-5,
 jsonb_build_object('fuso_plano',jsonb_build_object('fuso',current_setting('sso.fixture.fuso'),'vigenciaInicio',(current_setting('sso.fixture.hoje')::date-5)::text),
 'rotinas',jsonb_build_array(jsonb_build_object('id','16660000-0000-4000-8000-000000000031','rotina_logica_id','16660000-0000-4000-8000-000000000032','alvo_tipo','sistema','sistema_id','16660000-0000-4000-8000-000000000033','modo','calendario','data_base',(current_setting('sso.fixture.hoje')::date-1)::text,'intervalo_n',1,'intervalo_unidade','dias','tolerancia_antes',0,'tolerancia_depois',0))),
 '16660000-0000-4000-8000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by) values ('16660000-0000-4000-8000-000000000031','16660000-0000-4000-8000-000000000032','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','Rotina fuso','sistema','16660000-0000-4000-8000-000000000033','calendario',1,'dias',current_setting('sso.fixture.hoje')::date-1,'16660000-0000-4000-8000-000000000001');
update pcm.plano_transicao_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16660000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
-- Gates desligados: preserva a data anterior de São Paulo, independentemente do snapshot.
savepoint fallback;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000041','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.hoje')::date,'fixture');raise exception 'fallback_incorreto';exception when check_violation then if sqlerrm<>'transicao_exige_reconciliacao' then raise;end if;end;
 perform pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000041','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.sp')::date,'fixture');
end; $$;
rollback to savepoint fallback;
-- Configuração parcial jamais aplica silenciosamente o fuso antigo.
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
set local role authenticated;
do $$ begin begin perform pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000042','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.hoje')::date,'fixture');raise exception 'fuso_parcial_aceito';exception when object_not_in_prerequisite_state then if sqlerrm<>'configuracao_fuso_incompleta' then raise;end if;end;end; $$;
reset role;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
-- Histórico sem fuso não é presumido.
savepoint sem_fuso;
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=snapshot-'fuso_plano' where id='16660000-0000-4000-8000-000000000021';
set local session_replication_role=origin;
set local role authenticated;
do $$ begin begin perform pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000043','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.hoje')::date,'fixture');raise exception 'fuso_ausente_aceito';exception when check_violation then if sqlerrm<>'fuso_historico_indisponivel' then raise;end if;end;end; $$;
rollback to savepoint sem_fuso;
-- Encerramento usa o mesmo dia do Plano e não cancela OS.
savepoint encerrar_no_fuso;
set local role authenticated;
do $$ declare r jsonb;begin r:=pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000048','16660000-0000-4000-8000-000000000011',1,'encerrar',current_setting('sso.fixture.hoje')::date,'fixture');if r->>'state'<>'encerrado' then raise exception 'encerramento_divergente';end if;end; $$;
rollback to savepoint encerrar_no_fuso;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 begin perform pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000044','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.sp')::date,'fixture');raise exception 'data_sp_aceita_indevidamente';exception when check_violation then if sqlerrm<>'transicao_exige_reconciliacao' then raise;end if;end;
 a:=pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000044','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.hoje')::date,'fixture');
 b:=pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000044','16660000-0000-4000-8000-000000000011',1,'suspender',current_setting('sso.fixture.hoje')::date,'fixture');
 if a is distinct from b or a->>'state'<>'suspenso' then raise exception 'suspensao_ou_replay_divergente';end if;
 a:=pcm.sso_transicao_plano_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000045','16660000-0000-4000-8000-000000000011',2,'retomar',current_setting('sso.fixture.hoje')::date,'fixture');
 if a->>'state'<>'aprovado' then raise exception 'retomada_divergente';end if;
end; $$;
-- Um ciclo do dia anterior ao fuso da versão é elegível para decisão de vencido.
do $$ declare a jsonb;begin
 a:=pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000046','16660000-0000-4000-8000-000000000047','16660000-0000-4000-8000-000000000011',3,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.hoje')::date-1,'avaliar','fixture');
 if a->>'efeitoOperacional'<>'false' then raise exception 'decisao_divergente';end if;
end; $$;
reset role;
do $$ begin if exists(select 1 from pcm.ordens_servico where client_id='16660000-0000-4000-8000-00000000000a') then raise exception 'os_indevida';end if;if (select count(*) from pcm.auvo_sync_outbox)<>(select total from baseline_fuso_1666) then raise exception 'outbox_indevida';end if;end; $$;
