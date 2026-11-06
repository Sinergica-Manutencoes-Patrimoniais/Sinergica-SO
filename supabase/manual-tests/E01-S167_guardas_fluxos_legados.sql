-- Fixture transacional, sem Auvo; simula SQL dos escritores legados, não chamadas HTTP.
-- Executar 1028 e este roteiro na mesma transação de banco isolado e conferir pgTAP.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(14);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16799001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-escritores@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into pcm.clientes(id,nome,created_by) values ('16799001-0000-4000-8000-00000000000a','Cliente sintético','16799001-0000-4000-8000-000000000001');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
 ('16799001-0000-4000-8000-000000000011','CH-S167-WEB','16799001-0000-4000-8000-00000000000a','Chamado web','16799001-0000-4000-8000-000000000001'),
 ('16799001-0000-4000-8000-000000000012','CH-S167-BACKLOG','16799001-0000-4000-8000-00000000000a','Confirmação de backlog','16799001-0000-4000-8000-000000000001'),
 ('16799001-0000-4000-8000-000000000013','CH-S167-AUVO','16799001-0000-4000-8000-00000000000a','Levantamento Auvo simulado','16799001-0000-4000-8000-000000000001');
select lives_ok($$insert into pcm.ordens_servico(id,client_id,titulo,categoria,status,origem,created_by,chamado_id) values ('16799001-0000-4000-8000-000000000021','16799001-0000-4000-8000-00000000000a','OS web','corretiva','solicitacao','manual','16799001-0000-4000-8000-000000000001','16799001-0000-4000-8000-000000000011')$$,'inserção do fluxo web em Chamado aberto permanece possível');
select is((select numero from pcm.ordens_servico where id='16799001-0000-4000-8000-000000000021'),'CH-S167-WEB','trigger legado preserva número');
select lives_ok($$update pcm.chamados set ordem_servico_id='16799001-0000-4000-8000-000000000021',status='convertido_os',updated_by='16799001-0000-4000-8000-000000000001' where id='16799001-0000-4000-8000-000000000011'$$,'vínculo singular do fluxo web permanece possível');
select lives_ok($$insert into pcm.ordens_servico(id,client_id,titulo,categoria,status,origem,created_by,chamado_id) values ('16799001-0000-4000-8000-000000000022','16799001-0000-4000-8000-00000000000a','OS backlog','corretiva','backlog','manual','16799001-0000-4000-8000-000000000001',null)$$,'backlog sem Chamado permanece possível');
select ok((select numero like 'PRE-%' from pcm.ordens_servico where id='16799001-0000-4000-8000-000000000022'),'backlog mantém placeholder');
select lives_ok($$update pcm.ordens_servico set chamado_id='16799001-0000-4000-8000-000000000012',numero='CH-S167-BACKLOG' where id='16799001-0000-4000-8000-000000000022'$$,'confirmação legada de backlog permanece possível');
select lives_ok($$update pcm.chamados set ordem_servico_id='16799001-0000-4000-8000-000000000022',status='convertido_os' where id='16799001-0000-4000-8000-000000000012'$$,'confirmação de backlog vincula Chamado aberto');
select lives_ok($$insert into pcm.ordens_servico(id,client_id,titulo,categoria,status,origem,created_by,chamado_id,auvo_task_id) values ('16799001-0000-4000-8000-000000000023','16799001-0000-4000-8000-00000000000a','OS Auvo sintética','corretiva','solicitacao','auvo','16799001-0000-4000-8000-000000000001','16799001-0000-4000-8000-000000000013',16799001)$$,'inserção originada no Auvo simulada permanece possível');
select lives_ok($$update pcm.chamados set ordem_servico_id='16799001-0000-4000-8000-000000000023' where id='16799001-0000-4000-8000-000000000013'$$,'vínculo singular originado no Auvo permanece possível');
select lives_ok($$update pcm.ordens_servico set status='em_execucao' where id='16799001-0000-4000-8000-000000000023'$$,'atualização operacional de OS em Chamado aberto permanece possível');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"16799001-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}',true);
select lives_ok($$update pcm.ordens_servico set status='planejamento' where id='16799001-0000-4000-8000-000000000023'$$,'escritor autenticado altera status em Chamado aberto');
select set_config('request.jwt.claims','{"sub":"16799001-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}',true);
select throws_ok($$insert into pcm.ordens_servico(id,client_id,titulo,categoria,status,origem,created_by,chamado_id) values ('16799001-0000-4000-8000-000000000024','16799001-0000-4000-8000-00000000000a','OS indevida','corretiva','solicitacao','manual','16799001-0000-4000-8000-000000000001','16799001-0000-4000-8000-000000000013')$$,'42501',null,'RLS continua recusando inserção sem escrita');
select is((select count(*)::int from pcm.ordens_servico where id='16799001-0000-4000-8000-000000000024'),0,'RLS não deixou OS sem autorização');
reset role;
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('16799001-0000-4000-8000-000000000021','16799001-0000-4000-8000-000000000022','16799001-0000-4000-8000-000000000023')),0,'fixture não gera intenção Auvo');
select * from finish();
rollback;
