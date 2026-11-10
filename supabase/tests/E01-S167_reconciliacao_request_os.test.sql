-- 0929/0930: consulta de registro sintético, sem criar OS nem executar Auvo.
-- Não prova commit concorrente do comando criador; executar com migrations isoladas.
begin;
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('16710000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reconcilia-s167-a@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('16710000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reconcilia-s167-b@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('16710000-0000-4000-8000-000000000001','superadmin','Operador A',true),
 ('16710000-0000-4000-8000-000000000002','superadmin','Operador B',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('16710000-0000-4000-8000-00000000000a','Cliente A',true,'16710000-0000-4000-8000-000000000001'),
 ('16710000-0000-4000-8000-00000000000b','Cliente B',true,'16710000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16710000-0000-4000-8000-000000000001','chamado.os.criar','16710000-0000-4000-8000-00000000000a'),
 ('16710000-0000-4000-8000-000000000002','chamado.os.criar','16710000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values
 ('16710000-0000-4000-8000-000000000011','CH-TESTE-167-R','16710000-0000-4000-8000-00000000000a','Chamado','manual','aberto','16710000-0000-4000-8000-000000000001');
insert into pcm.chamado_os_comandos(request_id,actor_id,cliente_id,chamado_id,payload,resultado) values
 ('16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000001','16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011',
  jsonb_build_object('chamadoId','16710000-0000-4000-8000-000000000011','clienteId','16710000-0000-4000-8000-00000000000a','expectedRevision',1,'osId','16710000-0000-4000-8000-000000000021','titulo','Inspeção','descricao','Detalhes','categoria','corretiva'),
  jsonb_build_object('chamadoId','16710000-0000-4000-8000-000000000011','osId','16710000-0000-4000-8000-000000000021','numero','CH-TESTE-167-R-OS-1','revision',2,'requestId','16710000-0000-4000-8000-000000000101'));
select set_config('request.jwt.claims','{"sub":"16710000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
select throws_ok($$select pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')$$,'55000','reconciliacao_request_os_bloqueada','Gate desligado recusa consulta');
update pcm.sso_reconciliacao_request_os_gate set habilitado=true where id;
select is((pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')->>'estado'),'confirmado','Payload integral correspondente é confirmado');
select is((pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')->'resultado'->>'osId'),'16710000-0000-4000-8000-000000000021','Consulta repetida devolve mesma identidade');
select is((pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000102','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')->>'estado'),'indeterminado','Pedido ausente permanece indeterminado');
select is((pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000102','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')->>'autorizaNovaCriacao')::boolean,false,'Ausência não autoriza nova criação');
select throws_ok($$select pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000021',1,'Outra','Detalhes','corretiva')$$,'23514','identidade_request_incompativel','Mesmo request com payload divergente não confirma');
select throws_ok($$select pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000b','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')$$,'42501',null,'Cliente divergente não acessa');
select set_config('request.jwt.claims','{"sub":"16710000-0000-4000-8000-000000000002","role":"authenticated","user_role":"superadmin"}',true);
select throws_ok($$select pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')$$,'42501',null,'Outro ator concedido não lê pedido alheio');
select set_config('request.jwt.claims','{"sub":"16710000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
update config.sso_concessoes set ativa=false where usuario_id='16710000-0000-4000-8000-000000000001' and acao='chamado.os.criar';
select throws_ok($$select pcm.sso_reconciliar_request_os_chamado('16710000-0000-4000-8000-00000000000a','16710000-0000-4000-8000-000000000011','16710000-0000-4000-8000-000000000101','16710000-0000-4000-8000-000000000021',1,'Inspeção','Detalhes','corretiva')$$,'42501',null,'Concessão revogada impede consulta');
select * from finish();
rollback;
