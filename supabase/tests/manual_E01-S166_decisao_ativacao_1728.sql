-- Executar em clone descartável com migrations até 1728; chamador inicia e reverte a transação.
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
 'rotinas',jsonb_build_array(jsonb_build_object('id','16660000-0000-4000-8000-000000000031','rotina_logica_id','16660000-0000-4000-8000-000000000032','alvo_tipo','sistema','sistema_id','16660000-0000-4000-8000-000000000033','modo','calendario','data_base',(current_setting('sso.fixture.sp')::date-1)::text,'intervalo_n',1,'intervalo_unidade','dias','tolerancia_antes',0,'tolerancia_depois',0))),
 '16660000-0000-4000-8000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by) values ('16660000-0000-4000-8000-000000000031','16660000-0000-4000-8000-000000000032','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','Rotina fuso','sistema','16660000-0000-4000-8000-000000000033','calendario',1,'dias',current_setting('sso.fixture.sp')::date-1,'16660000-0000-4000-8000-000000000001');
update pcm.plano_transicao_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16660000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
-- Plano aprovado, nunca retomado: decisão do ciclo anterior permanece preliminar.
set local role authenticated;
do $$ declare a jsonb; b jsonb; begin
 a:=pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000046','17280000-0000-4000-8000-000000000047','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.sp')::date-1,'avaliar','fixture');
 b:=pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000046','17280000-0000-4000-8000-000000000047','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.sp')::date-1,'avaliar','fixture');
 if a is distinct from b or a->>'efeitoOperacional'<>'false' then raise exception 'decisao_ou_replay_divergente'; end if;
 begin
  perform pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000048','17280000-0000-4000-8000-000000000049','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',1,current_setting('sso.fixture.sp')::date,'avaliar','fixture');
  raise exception 'ciclo_nao_vencido_aceito';
 exception when check_violation then if sqlerrm <> 'candidato_nao_comprovado' then raise; end if; end;
 begin
  perform pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','17280000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000050','17280000-0000-4000-8000-000000000051','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.sp')::date-1,'avaliar','fixture');
  raise exception 'cliente_divergente_aceito';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
