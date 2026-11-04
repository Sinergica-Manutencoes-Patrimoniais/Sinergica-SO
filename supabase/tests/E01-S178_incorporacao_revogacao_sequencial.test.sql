-- Fixture sintética, exclusivamente transacional. Não dispara integração externa.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(16);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17896000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-revogado@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17896000-0000-0000-0000-000000000001','superadmin','S178 sintético',true);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17896000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-outro@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17896000-0000-0000-0000-000000000002','superadmin','S178 outro sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('17896000-0000-0000-0000-00000000000a','S178 sintético',true,'17896000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('17896000-0000-0000-0000-000000000001','cadastro.gerir','17896000-0000-0000-0000-00000000000a'),
 ('17896000-0000-0000-0000-000000000001','cadastro.aprovar','17896000-0000-0000-0000-00000000000a');
insert into pcm.areas(id,cliente_id,nome) values ('17896000-0000-0000-0000-000000000061','17896000-0000-0000-0000-00000000000a','Área sintética');
insert into pcm.locais(id,area_id,nome) values ('17896000-0000-0000-0000-000000000062','17896000-0000-0000-0000-000000000061','Local sintético');
insert into pcm.equipamento_categorias(id,nome) values ('17896000-0000-0000-0000-000000000071','Categoria sintética S178');
update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;
update pcm.sso_conferencia_lote_gate set habilitado=true where id;
update pcm.sso_incorporacao_aprovacao_gate set habilitado=true where id;
update pcm.sso_levantamento_ativos_gate set habilitado=true where chave;
update pcm.sso_validar_atributos_ativo_importado_gate set habilitado=true where id;
update pcm.sso_validar_atributos_grupo_importado_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17896000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select pcm.sso_receber_levantamento_manual('17896000-0000-0000-0000-000000000063','17896000-0000-0000-0000-00000000000a','planilha','s178-revogacao-sequencial','[{"chave":"sistema","tipo":"sistema","atributos":{"nome":"Sistema sintético"}},{"chave":"componente","tipo":"componente","atributos":{"nome":"Componente sintético"}},{"chave":"grupo","tipo":"grupo_quantitativo","atributos":{"nome":"Grupo sintético"}},{"chave":"sistema_negado","tipo":"sistema","atributos":{"nome":"Sistema negado"}},{"chave":"componente_negado","tipo":"componente","atributos":{"nome":"Componente negado"}},{"chave":"grupo_negado","tipo":"grupo_quantitativo","atributos":{"nome":"Grupo negado"}}]'::jsonb)->>'aggregateId' as lote \gset
select pcm.sso_registrar_conferencia_linha('17896000-0000-0000-0000-000000000064',:'lote',1,'sistema','{"nome":"Sistema sintético"}'::jsonb);
select pcm.sso_registrar_conferencia_linha('17896000-0000-0000-0000-000000000067',:'lote',2,'componente','{"nome":"Componente sintético"}'::jsonb);
select pcm.sso_registrar_conferencia_linha('17896000-0000-0000-0000-000000000068',:'lote',3,'grupo','{"nome":"Grupo sintético"}'::jsonb);
select pcm.sso_registrar_conferencia_linha('17896000-0000-0000-0000-000000000075',:'lote',4,'sistema_negado','{"nome":"Sistema negado"}'::jsonb);
select pcm.sso_registrar_conferencia_linha('17896000-0000-0000-0000-000000000076',:'lote',5,'componente_negado','{"nome":"Componente negado"}'::jsonb);
select pcm.sso_registrar_conferencia_linha('17896000-0000-0000-0000-000000000077',:'lote',6,'grupo_negado','{"nome":"Grupo negado"}'::jsonb);
select pcm.sso_concluir_conferencia_lote('17896000-0000-0000-0000-000000000065',:'lote',7);
set local role authenticated;
select lives_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,8,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000072', :'lote', 'sistema', '17896000-0000-0000-0000-000000000062', 'S178-POSITIVO'), 'Sistema autorizado é incorporado');
select lives_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,9,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000073', :'lote', 'componente', '17896000-0000-0000-0000-000000000062', 'S178-COMP-POSITIVO'), 'Componente autorizado é incorporado');
select lives_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,10,%L,%L,%L,null,null,null,1,0)',
 '17896000-0000-0000-0000-000000000074', :'lote', 'grupo', '17896000-0000-0000-0000-000000000062', '17896000-0000-0000-0000-000000000071'), 'Grupo autorizado é incorporado');
select lives_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,8,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000072', :'lote', 'sistema', '17896000-0000-0000-0000-000000000062', 'S178-POSITIVO'), 'repetição da incorporação autorizada é aceita');
select throws_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,8,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000072', :'lote', 'sistema', '17896000-0000-0000-0000-000000000062', 'S178-OUTRO'),
 '23505','request_id_conflitante','mesmo request com payload divergente é rejeitado');
select throws_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,8,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000079', :'lote', 'sistema_negado', '17896000-0000-0000-0000-000000000062', 'S178-REVOGADO'),
 '40001','revisao_obsoleta','outra incorporação com revisão antiga é rejeitada');
reset role;
select is((select count(*)::integer from pcm.sso_levantamento_incorporacoes where lote_id=:'lote'::uuid),3,'repetição não duplica incorporações');
set local request.jwt.claims='{"sub":"17896000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,11,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000078', :'lote', 'sistema_negado', '17896000-0000-0000-0000-000000000062', 'S178-REVOGADO'),
 '42501','sem_acesso','usuário sem concessão ao Cliente não incorpora');
reset role;
set local request.jwt.claims='{"sub":"17896000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
update config.sso_concessoes set ativa=false where usuario_id='17896000-0000-0000-0000-000000000001' and acao='cadastro.aprovar';
set local role authenticated;
select throws_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,11,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000066', :'lote', 'sistema_negado', '17896000-0000-0000-0000-000000000062', 'S178-REVOGADO'),
 '42501','sem_acesso','nova incorporação é negada após revogação');
select throws_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,11,%L,%L,null,null,null,%L,null,0)',
 '17896000-0000-0000-0000-000000000069', :'lote', 'componente_negado', '17896000-0000-0000-0000-000000000062', 'S178-COMP-REVOGADO'),
 '42501','sem_acesso','Componente é negado após revogação');
select throws_ok(format('select pcm.sso_incorporar_ativo_autorizado(%L,%L,11,%L,%L,%L,null,null,null,1,0)',
 '17896000-0000-0000-0000-000000000070', :'lote', 'grupo_negado', '17896000-0000-0000-0000-000000000062', '17896000-0000-0000-0000-000000000071'),
 '42501','sem_acesso','Grupo é negado após revogação');
reset role;
select is((select count(*)::integer from pcm.sistemas where codigo='S178-REVOGADO'),0,'Sistema negado não foi incorporado');
select is((select count(*)::integer from pcm.equipamentos where identificador='S178-COMP-REVOGADO'),0,'Componente negado não foi incorporado');
select is((select count(*)::integer from pcm.grupos_quantitativos where cliente_id='17896000-0000-0000-0000-00000000000a'),1,'somente Grupo autorizado foi incorporado');
select is((select count(*)::integer from pcm.sso_levantamento_incorporacoes where lote_id=:'lote'::uuid),3,'somente as três incorporações autorizadas foram registradas');
select ok(not (select ativa from config.sso_concessoes where usuario_id='17896000-0000-0000-0000-000000000001' and acao='cadastro.aprovar'),'concessão permanece revogada na transação');
select * from finish();
rollback;
