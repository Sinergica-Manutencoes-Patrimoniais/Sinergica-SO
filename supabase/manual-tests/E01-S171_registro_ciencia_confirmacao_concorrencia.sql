-- Somente banco de teste dedicado, sem dados reais, com migrations E01-S171
-- e pgTAP instalados. Executar como superusuário; dblink é criado na transação
-- principal e revertido ao final, caso ainda não exista.
-- Fixtures 171a0000-* e ciência/confirmação/auditoria sintéticas serão COMMITADAS
-- e permanecerão no banco descartável. Nunca repetir no mesmo banco. Nenhum Auvo.
begin;
create extension if not exists dblink with schema extensions;
set local search_path = extensions, public;
select plan(11);
select extensions.dblink_connect_u('s171ca', 'dbname=postgres user=postgres');
select extensions.dblink_connect_u('s171cb', 'dbname=postgres user=postgres');
select extensions.dblink_exec('s171ca', $$set statement_timeout = '15s'$$);
select extensions.dblink_exec('s171cb', $$set statement_timeout = '15s'$$);
select extensions.dblink_exec('s171ca', $$
 set app.auvo_sync_write = 'true';
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values ('171a0000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ciencia-confirmacao-concorrente@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
 insert into config.usuarios(user_id,papel,nome,ativo) values ('171a0000-0000-0000-0000-000000000001','superadmin','Ciência concorrente',true);
 insert into pcm.clientes(id,nome,ativo,created_by) values ('171a0000-0000-0000-0000-00000000000a','Cliente concorrente',true,'171a0000-0000-0000-0000-000000000001');
 insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('171a0000-0000-0000-0000-000000000001','visita.confirmar','171a0000-0000-0000-0000-00000000000a');
 insert into pcm.funcionarios(id,nome,ativo) values ('171a0000-0000-0000-0000-000000000041','Técnico concorrente',true);
 insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values ('171a0000-0000-0000-0000-000000000051','171a0000-0000-0000-0000-00000000000a','OS-S171-CIENCIA-CONCORRENTE','OS sintética','preventiva','171a0000-0000-0000-0000-000000000001');
 insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,responsavel_id,created_by) values ('171a0000-0000-0000-0000-000000000061','171a0000-0000-0000-0000-00000000000a','2026-11-01 11:00+00','2026-11-01 13:00+00','America/Sao_Paulo','regular','planejada','171a0000-0000-0000-0000-000000000041','171a0000-0000-0000-0000-000000000001');
 insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values ('171a0000-0000-0000-0000-000000000071','171a0000-0000-0000-0000-000000000061','171a0000-0000-0000-0000-000000000051','171a0000-0000-0000-0000-00000000000a',1,'171a0000-0000-0000-0000-000000000001');
 insert into pcm.visita_equipes(id,visita_id,cliente_id,funcionario_id,papel,created_by) values ('171a0000-0000-0000-0000-000000000081','171a0000-0000-0000-0000-000000000061','171a0000-0000-0000-0000-00000000000a','171a0000-0000-0000-0000-000000000041','Técnico','171a0000-0000-0000-0000-000000000001');
$$);
select extensions.dblink_exec('s171cb', $$set app.auvo_sync_write = 'true'$$);
select extensions.dblink_exec('s171ca', $$set request.jwt.claims = '{"sub":"171a0000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
select extensions.dblink_exec('s171cb', $$set request.jwt.claims = '{"sub":"171a0000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
select extensions.dblink_exec('s171ca', 'set role authenticated');
select extensions.dblink_exec('s171cb', 'set role authenticated');
-- Ciência primeiro: confirmação aguarda; ciência comitada deve valer para a revisão confirmada.
select extensions.dblink_exec('s171ca', 'begin');
select extensions.dblink_exec('s171cb', 'begin');
select is(resultado->>'state','planejada','ciência registra revisão planejada') from extensions.dblink('s171ca', $$select pcm.sso_registrar_ciencia_visita('171a0000-0000-0000-0000-000000000101',1,'171a0000-0000-0000-0000-000000000061','2026-01-01 12:00+00','Síndico sintético','telefone','Ciência sintética')$$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s171cb', $$select pcm.sso_confirmar_visita('171a0000-0000-0000-0000-000000000102',1,'171a0000-0000-0000-0000-000000000061')$$),1,'inicia confirmação');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171cb'),1,'confirmação espera registro de ciência');
select extensions.dblink_exec('s171ca', 'commit');
select is(resultado->>'state','confirmada','confirmação prossegue após commit da ciência') from extensions.dblink_get_result('s171cb') as t(resultado jsonb);
select * from extensions.dblink_get_result('s171cb') as t(resultado jsonb);
select is(resultado->>'cienciaEncontrada','true','conferência encontra ciência anterior') from extensions.dblink('s171cb', $$select pcm.sso_conferir_ciencia_visita('171a0000-0000-0000-0000-000000000061')$$) as t(resultado jsonb);
select extensions.dblink_exec('s171cb', 'rollback');
-- Confirmação primeiro: nova ciência com revisão antiga deve ser recusada.
select extensions.dblink_exec('s171ca', 'begin');
select extensions.dblink_exec('s171cb', 'begin');
select is(resultado->>'state','confirmada','confirmação começa primeiro') from extensions.dblink('s171ca', $$select pcm.sso_confirmar_visita('171a0000-0000-0000-0000-000000000103',1,'171a0000-0000-0000-0000-000000000061')$$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s171cb', $$select pcm.sso_registrar_ciencia_visita('171a0000-0000-0000-0000-000000000104',1,'171a0000-0000-0000-0000-000000000061','2026-01-01 12:00+00','Síndico sintético','telefone','Tentativa obsoleta')$$),1,'inicia ciência concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171cb'),1,'ciência espera confirmação');
select extensions.dblink_exec('s171ca', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s171cb',false) as t(resultado jsonb)),0,'revisão antiga é recusada');
select ok(position('revisao_obsoleta' in extensions.dblink_error_message('s171cb')) > 0,'recusa identifica revisão obsoleta');
select * from extensions.dblink_get_result('s171cb',false) as t(resultado jsonb);
select extensions.dblink_exec('s171cb', 'rollback');
select is((select count(*)::int from pcm.visita_ciencias where visita_id='171a0000-0000-0000-0000-000000000061'),1,'somente primeira ciência foi preservada');
select extensions.dblink_disconnect('s171ca');
select extensions.dblink_disconnect('s171cb');
select * from finish();
rollback;
