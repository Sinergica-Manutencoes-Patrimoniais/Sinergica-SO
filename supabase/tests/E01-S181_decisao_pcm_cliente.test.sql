-- Fixture sintética; executar somente em banco de testes descartável com migrations disponíveis.
-- O grant e os gates são locais à transação e revertidos por rollback.
begin;
select plan(15);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18110000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pcm-181@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('18110000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cliente-181@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('18110000-0000-0000-0000-000000000001','superadmin','PCM teste',true),
 ('18110000-0000-0000-0000-000000000002','cliente-sindico','Cliente teste',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('18110000-0000-0000-0000-00000000000a','Cliente S181',true,'18110000-0000-0000-0000-000000000001');
insert into config.usuario_cliente(user_id,cliente_id) values ('18110000-0000-0000-0000-000000000002','18110000-0000-0000-0000-00000000000a');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('18110000-0000-0000-0000-000000000001','orcamento.emitir','18110000-0000-0000-0000-00000000000a'),
 ('18110000-0000-0000-0000-000000000001','execucao.validar','18110000-0000-0000-0000-00000000000a');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values
 ('18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-00000000000a','OS-DECISAO-S181','OS de teste','corretiva','18110000-0000-0000-0000-000000000001');
insert into pcm.listas_materiais(id,cliente_id,ordem_servico_id,responsavel,texto_original,criado_por) values
 ('18110000-0000-0000-0000-000000000021','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','sinergica','Material teste','18110000-0000-0000-0000-000000000001');
update comercial.sso_origem_operacional_gate set habilitado=true where id;
insert into comercial.propostas(id,oportunidade_id,tipo,status,versao_atual,preco_centavos,piso_centavos) values
 ('18110000-0000-0000-0000-000000000031',null,'simples','enviada',1,15000,10000);
insert into comercial.proposta_origens_operacionais(proposta_id,ordem_servico_id,lista_materiais_id,criado_por) values
 ('18110000-0000-0000-0000-000000000031','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000021','18110000-0000-0000-0000-000000000001');
insert into comercial.proposta_versoes(proposta_id,versao,payload,criado_por) values ('18110000-0000-0000-0000-000000000031',1,'{}','18110000-0000-0000-0000-000000000001');
insert into comercial.sso_orcamento_publicacoes(proposta_id,versao,payload_publico,autor_id) values ('18110000-0000-0000-0000-000000000031',1,'{}','18110000-0000-0000-0000-000000000001');
create temporary table s181_baseline as select (select count(*) from pcm.ordens_servico) os,(select count(*) from financeiro.itens_faturaveis) itens,(select count(*) from pcm.auvo_sync_outbox) outbox;
grant execute on function comercial.sso_decidir_orcamento_pcm(uuid,uuid,uuid,uuid,integer,text,text,text),comercial.sso_portal_decidir_proposta_versionada(uuid,uuid,integer,text,text) to authenticated;
set local request.jwt.claims = '{"sub":"18110000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$ select comercial.sso_decidir_orcamento_pcm('18110000-0000-0000-0000-000000000041','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000031',1,'aceita','Revisado','Referência declarada') $$,'55000',null,'gate fechado bloqueia decisão PCM');
reset role;
update comercial.sso_decisao_pcm_orcamento_gate set habilitado=true where id;
set local role authenticated;
select lives_ok($$ select comercial.sso_decidir_orcamento_pcm('18110000-0000-0000-0000-000000000041','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000031',1,'aceita','Revisado','Referência declarada') $$,'PCM registra decisão interna');
select is((comercial.sso_decidir_orcamento_pcm('18110000-0000-0000-0000-000000000041','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000031',1,'aceita','Revisado','Referência declarada')->>'evidenciaAutenticada')::boolean,false,'retry preserva identidade e não autentica evidência');
select throws_ok($$ select comercial.sso_decidir_orcamento_pcm('18110000-0000-0000-0000-000000000041','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000031',1,'recusada','Revisado','Referência declarada') $$,'23505',null,'request reutilizado com conteúdo diferente falha');
reset role;
select is((select status from comercial.propostas where id='18110000-0000-0000-0000-000000000031'),'enviada','PCM não altera estado público');
select is((select count(*)::int from comercial.proposta_decisoes where proposta_id='18110000-0000-0000-0000-000000000031'),0,'PCM não ocupa decisão legada do Cliente');
select is((select count(*)::int from comercial.sso_decisoes_origem_orcamento where proposta_id='18110000-0000-0000-0000-000000000031'),1,'retry não duplica decisão interna');
update config.sso_concessoes set ativa=false where usuario_id='18110000-0000-0000-0000-000000000001' and acao='orcamento.emitir' and cliente_id='18110000-0000-0000-0000-00000000000a';
set local role authenticated;
select throws_ok($$ select comercial.sso_decidir_orcamento_pcm('18110000-0000-0000-0000-000000000041','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000031',1,'aceita','Revisado','Referência declarada') $$,'42501',null,'retry revalida concessão revogada');
reset role;
update config.sso_concessoes set ativa=true where usuario_id='18110000-0000-0000-0000-000000000001' and acao='orcamento.emitir' and cliente_id='18110000-0000-0000-0000-00000000000a';
set local request.jwt.claims = '{"sub":"18110000-0000-0000-0000-000000000001","role":"authenticated","user_role":"pcm"}';
set local role authenticated;
select throws_ok($$ select comercial.sso_decidir_orcamento_pcm('18110000-0000-0000-0000-000000000041','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000031',1,'aceita','Revisado','Referência declarada') $$,'42501',null,'sessão com papel divergente do cadastro não recupera decisão');
reset role;
set local request.jwt.claims = '{"sub":"18110000-0000-0000-0000-000000000002","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18110000-0000-0000-0000-00000000000a"}';
set local role authenticated;
select throws_ok($$ select comercial.sso_decidir_orcamento_pcm('18110000-0000-0000-0000-000000000043','18110000-0000-0000-0000-00000000000a','18110000-0000-0000-0000-000000000011','18110000-0000-0000-0000-000000000031',1,'aceita','Revisado','Referência declarada') $$,'42501',null,'Cliente não usa comando interno PCM');
select lives_ok($$ select comercial.sso_portal_decidir_proposta_versionada('18110000-0000-0000-0000-000000000042','18110000-0000-0000-0000-000000000031',1,'aceita',null) $$,'Cliente ainda pode decidir a mesma versão');
reset role;
select is((select count(*)::int from comercial.proposta_decisoes where proposta_id='18110000-0000-0000-0000-000000000031' and autor_user_id='18110000-0000-0000-0000-000000000002'),1,'decisão do Cliente preserva autoria própria');
select is((select count(*) from pcm.ordens_servico),(select os from s181_baseline),'nenhuma OS substituta foi criada');
select is((select count(*) from financeiro.itens_faturaveis),(select itens from s181_baseline),'nenhum faturável foi criado');
select is((select count(*) from pcm.auvo_sync_outbox),(select outbox from s181_baseline),'nenhuma intenção Auvo foi criada');
select * from finish();
rollback;
