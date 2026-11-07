-- Fixtures isoladas; testes preparados sem habilitar gates fora da transação.
begin;
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('16510000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s165-contrato@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16510000-0000-4000-8000-000000000001','superadmin','Gestor teste',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('16510000-0000-4000-8000-00000000000a','Cliente A',true,'16510000-0000-4000-8000-000000000001'),
 ('16510000-0000-4000-8000-00000000000b','Cliente B',true,'16510000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16510000-0000-4000-8000-000000000001','plano.gerir','16510000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values ('16510000-0000-4000-8000-000000000051','16510000-0000-4000-8000-00000000000a','Sistema');
insert into pcm.questionarios(id,auvo_id,nome,perguntas,ativo) values ('16510000-0000-4000-8000-000000000091',165100091,'Questionário','[{"id":"p1","texto":"Conferir"}]'::jsonb,true);
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values
 ('16510000-0000-4000-8000-000000000011','16510000-0000-4000-8000-00000000000a','Plano revisão','em_revisao','16510000-0000-4000-8000-000000000001'),
 ('16510000-0000-4000-8000-000000000012','16510000-0000-4000-8000-00000000000a','Plano inicial','rascunho','16510000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values
 ('16510000-0000-4000-8000-000000000021','16510000-0000-4000-8000-000000000011',1,'aprovado','{"rotinas":[{"id":"historico","pergunta":"original"}]}'::jsonb,'16510000-0000-4000-8000-000000000001'),
 ('16510000-0000-4000-8000-000000000022','16510000-0000-4000-8000-000000000011',2,'rascunho',null,'16510000-0000-4000-8000-000000000001'),
 ('16510000-0000-4000-8000-000000000023','16510000-0000-4000-8000-000000000012',1,'rascunho',null,'16510000-0000-4000-8000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,questionario_id,created_by) values
 ('16510000-0000-4000-8000-000000000081','16510000-0000-4000-8000-000000000083','16510000-0000-4000-8000-000000000011','16510000-0000-4000-8000-000000000022','Revisão','sistema','16510000-0000-4000-8000-000000000051','calendario','16510000-0000-4000-8000-000000000091','16510000-0000-4000-8000-000000000001'),
 ('16510000-0000-4000-8000-000000000082','16510000-0000-4000-8000-000000000084','16510000-0000-4000-8000-000000000012','16510000-0000-4000-8000-000000000023','Inicial','sistema','16510000-0000-4000-8000-000000000051','calendario','16510000-0000-4000-8000-000000000091','16510000-0000-4000-8000-000000000001');
update pcm.sso_contrato_pergunta_gate set habilitado=true where id;
update pcm.sso_contrato_evidencia_gate set habilitado=true where id;
select set_config('request.jwt.claims','{"sub":"16510000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
select lives_ok($$select pcm.sso_configurar_obrigatoriedade_pergunta('16510000-0000-4000-8000-000000000101','16510000-0000-4000-8000-00000000000a','16510000-0000-4000-8000-000000000012',1,'16510000-0000-4000-8000-000000000023','16510000-0000-4000-8000-000000000082','p1',true,'Conferido')$$,'Rascunho inicial permanece editável com gate de revisão desligado');
select throws_ok($$select pcm.sso_configurar_obrigatoriedade_pergunta('16510000-0000-4000-8000-000000000102','16510000-0000-4000-8000-00000000000a','16510000-0000-4000-8000-000000000011',1,'16510000-0000-4000-8000-000000000022','16510000-0000-4000-8000-000000000081','p1',true,'Conferido')$$,'23514','plano_nao_editavel','Revisão fechada por padrão');
update pcm.sso_contratos_em_revisao_gate set habilitado=true where id;
select lives_ok($$select pcm.sso_configurar_obrigatoriedade_pergunta('16510000-0000-4000-8000-000000000102','16510000-0000-4000-8000-00000000000a','16510000-0000-4000-8000-000000000011',1,'16510000-0000-4000-8000-000000000022','16510000-0000-4000-8000-000000000081','p1',true,'Conferido')$$,'Configura resposta na revisão');
select lives_ok($$select pcm.sso_configurar_evidencia_pergunta('16510000-0000-4000-8000-000000000103','16510000-0000-4000-8000-00000000000a','16510000-0000-4000-8000-000000000011',2,'16510000-0000-4000-8000-000000000022','16510000-0000-4000-8000-000000000081','p1',true,'Conferido')$$,'Configura evidência com revisão atual');
select is((select snapshot from pcm.plano_versoes where id='16510000-0000-4000-8000-000000000021'),'{"rotinas":[{"id":"historico","pergunta":"original"}]}'::jsonb,'Snapshot aprovado preservado');
select throws_ok($$select pcm.sso_configurar_obrigatoriedade_pergunta('16510000-0000-4000-8000-000000000104','16510000-0000-4000-8000-00000000000b','16510000-0000-4000-8000-000000000011',3,'16510000-0000-4000-8000-000000000022','16510000-0000-4000-8000-000000000081','p1',true,'Conferido')$$,'42501',null,'Cliente divergente é recusado');
select throws_ok($$select pcm.sso_configurar_evidencia_pergunta('16510000-0000-4000-8000-000000000105','16510000-0000-4000-8000-00000000000a','16510000-0000-4000-8000-000000000011',1,'16510000-0000-4000-8000-000000000022','16510000-0000-4000-8000-000000000081','p1',false,'Conferido')$$,'40001',null,'Revisão antiga é recusada');
update config.sso_concessoes set ativa=false where usuario_id='16510000-0000-4000-8000-000000000001' and acao='plano.gerir';
select throws_ok($$select pcm.sso_configurar_obrigatoriedade_pergunta('16510000-0000-4000-8000-000000000106','16510000-0000-4000-8000-00000000000a','16510000-0000-4000-8000-000000000011',3,'16510000-0000-4000-8000-000000000022','16510000-0000-4000-8000-000000000081','p1',true,'Conferido')$$,'42501',null,'Concessão revogada bloqueia escrita');
select is((select revisao from pcm.planos_manutencao where id='16510000-0000-4000-8000-000000000011'),3,'Recusas não alteram revisão');
select * from finish();
rollback;
