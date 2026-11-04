-- Somente ensaio em transação descartável. Não autoriza remover restrições em rollout.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
set local app.auvo_sync_write='true';
select plan(14);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16710000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','multiplas-s167@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16710000-0000-4000-8000-000000000001','superadmin','Teste',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16710000-0000-4000-8000-00000000000a','Cliente teste',true,'16710000-0000-4000-8000-000000000001');
insert into pcm.clientes(id,nome,ativo,created_by) values ('16710000-0000-4000-8000-00000000000b','Outro Cliente teste',true,'16710000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16710000-0000-4000-8000-000000000001','chamado.os.criar','16710000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values ('16710000-0000-4000-8000-000000000011','CH-TESTE-167-MULT','16710000-0000-4000-8000-00000000000a','Chamado teste','manual','aberto','16710000-0000-4000-8000-000000000001');
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values ('16710000-0000-4000-8000-000000000012','CH-TESTE-167-LEG','16710000-0000-4000-8000-00000000000a','Chamado legado','manual','aberto','16710000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,chamado_id,numero,titulo,categoria,created_by) values ('16710000-0000-4000-8000-000000000023','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000012','IGNORADO','OS legada','corretiva','16710000-0000-4000-8000-000000000001');
update pcm.chamados set ordem_servico_id='16710000-0000-4000-8000-000000000023',status='convertido_os' where id='16710000-0000-4000-8000-000000000012';
set local request.jwt.claims='{"sub":"16710000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
update pcm.sso_criacao_os_mediada_gate set habilitado=true where id;
update pcm.chamado_os_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000101',1,'16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000021','Primeira',null,'corretiva')$$,'55000','transicao_legada_incompleta','restrições reais impedem geração antes da transição');
reset role;
-- Exercício reversível apenas neste banco isolado, não proposta de rollout.
drop index pcm.uq_ordens_servico_chamado;
drop trigger trg_ordens_servico_numero_chamado on pcm.ordens_servico;
-- A guarda aditiva participa da mesma transição reversível neste ensaio.
update pcm.sso_guarda_multiplas_os_gate set habilitado=true where id;
create temporary table s167_outbox_antes as select count(*) n from pcm.auvo_sync_outbox;
set local role authenticated;
select is(pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000101',1,'16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000021','Primeira',null,'corretiva')->>'osId','16710000-0000-4000-8000-000000000021','cria primeira OS no ensaio');
select is(pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000102',2,'16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000022','Segunda',null,'corretiva')->>'osId','16710000-0000-4000-8000-000000000022','cria segunda OS no ensaio');
select is(pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000102',2,'16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000022','Segunda',null,'corretiva')->>'osId','16710000-0000-4000-8000-000000000022','replay preserva identidade');
select throws_ok($$select pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000102',2,'16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000022','Alterada',null,'corretiva')$$,'23505','request_id_conflitante','replay divergente negado');
select throws_ok($$select pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000104',3,'16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-00000000000b','16710000-0000-4000-8000-000000000025','Outro Cliente',null,'corretiva')$$,'42501',null,'Cliente divergente não cria OS');
-- Edição intermediária não é uma adição de OS e deve impedir reconciliação da revisão antiga.
reset role;
update pcm.chamados set titulo='Chamado alterado' where id='16710000-0000-4000-8000-000000000011';
set local role authenticated;
select throws_ok($$select pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000105',1,'16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000026','Revisão antiga',null,'corretiva')$$,'40001','revisao_obsoleta','revisão antiga não cria OS');
select is(pcm.sso_criar_os_chamado_autorizado('16710000-0000-4000-8000-000000000103',2,'16710000-0000-4000-8000-000000000012','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000024','Continuação',null,'corretiva')->>'osId','16710000-0000-4000-8000-000000000024','acrescenta OS a Chamado legado no ensaio');
reset role;
select is((select count(*)::int from pcm.ordens_servico where chamado_id='16710000-0000-4000-8000-000000000011'),2,'duas OS vinculadas');
select is((select count(distinct numero)::int from pcm.ordens_servico where chamado_id='16710000-0000-4000-8000-000000000011'),2,'números distintos');
select is((select ordem_servico_id::text from pcm.chamados where id='16710000-0000-4000-8000-000000000011'),'16710000-0000-4000-8000-000000000021','campo legado preserva primeira OS');
select is((select numero from pcm.ordens_servico where id='16710000-0000-4000-8000-000000000023'),'CH-TESTE-167-LEG','número da OS legada preservado');
select is((select ordem_servico_id::text from pcm.chamados where id='16710000-0000-4000-8000-000000000012'),'16710000-0000-4000-8000-000000000023','vínculo legado permanece na OS original');
select is((select count(*) from pcm.auvo_sync_outbox),(select n from s167_outbox_antes),'não cria outbox Auvo');
select * from finish();
rollback;
