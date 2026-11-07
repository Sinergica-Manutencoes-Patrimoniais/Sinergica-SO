-- NÃO EXECUTADO. Somente banco descartável novo, sem dados reais, com 0313 e
-- extensões pgtap/dblink instaladas. Executar como supabase_admin com ON_ERROR_STOP.
-- As fixtures 16620000-* são COMMITADAS e permanecem no banco descartável;
-- nunca executar em banco compartilhado ou produção, nem repetir no mesmo banco.
-- As duas inserções de origem disputadas são revertidas. Nenhum comando Auvo.
begin;
set local search_path = extensions, public;
select plan(5);
select extensions.dblink_connect_u('s166a', 'dbname=postgres user=postgres');
select extensions.dblink_connect_u('s166b', 'dbname=postgres user=postgres');
select extensions.dblink_exec('s166a', $$
 set app.auvo_sync_write = 'true';
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values ('16620000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','origem-concorrente@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
 insert into config.usuarios(user_id,papel,nome,ativo) values ('16620000-0000-0000-0000-000000000001','superadmin','Origem concorrente',true);
 insert into pcm.clientes(id,nome,ativo,created_by) values ('16620000-0000-0000-0000-00000000000a','Cliente concorrente',true,'16620000-0000-0000-0000-000000000001');
 insert into comercial.etapas_funil(id,nome,ordem,cor) values ('16620000-0000-0000-0000-000000000021','Origem concorrente',1,'#000');
 insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('16620000-0000-0000-0000-000000000031','16620000-0000-0000-0000-00000000000a','16620000-0000-0000-0000-000000000021','Origem concorrente');
 insert into comercial.propostas(id,oportunidade_id,tipo) values ('16620000-0000-0000-0000-000000000041','16620000-0000-0000-0000-000000000031','volante');
 insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio) values ('16620000-0000-0000-0000-000000000051','16620000-0000-0000-0000-000000000041','16620000-0000-0000-0000-00000000000a','volante','2026-01-01');
 insert into pcm.calendario_contratual_series(id,cliente_id,contrato_id,created_by) values ('16620000-0000-0000-0000-000000000061','16620000-0000-0000-0000-00000000000a','16620000-0000-0000-0000-000000000051','16620000-0000-0000-0000-000000000001');
 insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,fuso,vigencia_inicio,created_by) values ('16620000-0000-0000-0000-000000000071','16620000-0000-0000-0000-000000000061',1,'2026-10-05',5,1,'08:00',120,'America/Sao_Paulo','2026-10-01','16620000-0000-0000-0000-000000000001');
 insert into pcm.visitas(id,cliente_id,contrato_id,inicio_em,fim_em,fuso,natureza,created_by) values ('16620000-0000-0000-0000-000000000081','16620000-0000-0000-0000-00000000000a','16620000-0000-0000-0000-000000000051','2026-10-09 11:00+00','2026-10-09 13:00+00','America/Sao_Paulo','regular','16620000-0000-0000-0000-000000000001');
$$);
select extensions.dblink_exec('s166b', $$set app.auvo_sync_write = 'true'$$);
select extensions.dblink_exec('s166a', 'begin');
select extensions.dblink_exec('s166b', 'begin');
select extensions.dblink_exec('s166a', $$insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) values ('16620000-0000-0000-0000-000000000081','16620000-0000-0000-0000-00000000000a','16620000-0000-0000-0000-000000000051','16620000-0000-0000-0000-000000000061','16620000-0000-0000-0000-000000000071','2026-10-05','16620000-0000-0000-0000-000000000001')$$);
select is(extensions.dblink_send_query('s166b', $$insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) values ('16620000-0000-0000-0000-000000000081','16620000-0000-0000-0000-00000000000a','16620000-0000-0000-0000-000000000051','16620000-0000-0000-0000-000000000061','16620000-0000-0000-0000-000000000071','2026-10-05','16620000-0000-0000-0000-000000000001') returning visita_id$$), 1, 'inicia inserção concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s166b'), 1, 'segunda inserção aguarda primeira');
select extensions.dblink_exec('s166a', 'rollback');
select is(visita_id, '16620000-0000-0000-0000-000000000081'::uuid, 'segunda inserção prossegue após rollback') from extensions.dblink_get_result('s166b') as t(visita_id uuid);
select * from extensions.dblink_get_result('s166b') as t(visita_id uuid);
select extensions.dblink_exec('s166b', 'rollback');
select is((select count(*)::int from pcm.visita_origem_contratual where visita_id='16620000-0000-0000-0000-000000000081'), 0, 'nenhuma origem disputada persiste');
select is((select count(*)::int from pcm.visitas where id='16620000-0000-0000-0000-000000000081'), 1, 'Visita sintética permanece para inspeção');
select extensions.dblink_disconnect('s166a');
select extensions.dblink_disconnect('s166b');
select * from finish();
rollback;
