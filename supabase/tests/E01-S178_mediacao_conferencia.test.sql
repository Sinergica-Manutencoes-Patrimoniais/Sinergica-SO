-- Somente banco isolado; fixtures e alteração de gates são revertidas no rollback.
begin;
set local app.auvo_sync_write = 'true';
select plan(17);
select ok(not has_function_privilege('anon','pcm.sso_conferir_linha_autorizada(uuid,uuid,integer,text,jsonb)','EXECUTE'),'anon não executa mediador');
select ok(not has_function_privilege('service_role','pcm.sso_conferir_linha_autorizada(uuid,uuid,integer,text,jsonb)','EXECUTE'),'service_role não executa mediador');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17810000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-mediacao@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17810000-0000-0000-0000-000000000001','colaborador','S178 mediacao',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17810000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17810000-0000-0000-0000-00000000000a','Mediacao A',true,'17810000-0000-0000-0000-000000000001'),
 ('17810000-0000-0000-0000-00000000000b','Mediacao B',true,'17810000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17810000-0000-0000-0000-000000000001','cadastro.aprovar','17810000-0000-0000-0000-00000000000a');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values
 ('17810000-0000-0000-0000-00000000010a','17810000-0000-0000-0000-00000000000a','manual','mediacao-a','[]','17810000-0000-0000-0000-000000000001'),
 ('17810000-0000-0000-0000-00000000010b','17810000-0000-0000-0000-00000000000b','manual','mediacao-b','[]','17810000-0000-0000-0000-000000000001');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values
 ('17810000-0000-0000-0000-00000000010a','a','area','{"nome":"Area A"}'),
 ('17810000-0000-0000-0000-00000000010a','b','local','{"nome":"Local B"}'),
 ('17810000-0000-0000-0000-00000000010b','a','area','{"nome":"Area B"}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17810000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
select throws_ok($$select pcm.sso_resumo_conferencia_autorizado('17810000-0000-0000-0000-00000000010a')$$,'55000',null,'gate da mediação fechado por padrão');
select throws_ok($$select pcm.sso_registrar_conferencia_linha('17810000-0000-0000-0000-000000000101','17810000-0000-0000-0000-00000000010a',1,'a','{"nome":"Area A"}')$$,'42501',null,'núcleo não é acessível diretamente');
reset role;
update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select pcm.sso_resumo_conferencia_autorizado('17810000-0000-0000-0000-00000000010b')$$,'42501',null,'resumo não cruza Cliente');
select throws_ok($$select pcm.sso_conferir_linha_autorizada('17810000-0000-0000-0000-000000000101','17810000-0000-0000-0000-00000000010b',1,'a','{"nome":"Area B"}')$$,'42501',null,'conferência não cruza Cliente');
select throws_ok($$select pcm.sso_rejeitar_linha_autorizado('17810000-0000-0000-0000-000000000102','17810000-0000-0000-0000-00000000010b',1,'a','motivo')$$,'42501',null,'rejeição não cruza Cliente');
select throws_ok($$select pcm.sso_editar_linha_autorizado('17810000-0000-0000-0000-000000000103','17810000-0000-0000-0000-00000000010b',1,'a','{"nome":"Area B"}',true,'novo',false,null,'motivo')$$,'42501',null,'edição não cruza Cliente');
select throws_ok($$select pcm.sso_concluir_conferencia_autorizado('17810000-0000-0000-0000-000000000104','17810000-0000-0000-0000-00000000010b',1)$$,'42501',null,'conclusão não cruza Cliente');
select throws_ok($$select pcm.sso_reabrir_conferencia_autorizado('17810000-0000-0000-0000-000000000104','17810000-0000-0000-0000-00000000010b',1,'motivo')$$,'42501',null,'reabertura não cruza Cliente');
select throws_ok($$select pcm.sso_retrato_aprovacao_autorizado('17810000-0000-0000-0000-00000000010b','a')$$,'42501',null,'retrato não cruza Cliente');
select throws_ok($$select pcm.sso_aprovar_linhas_autorizado('17810000-0000-0000-0000-000000000104','17810000-0000-0000-0000-00000000010b',1,'[]','motivo',true)$$,'42501',null,'aprovação não cruza Cliente');
reset role;
update pcm.sso_conferencia_lote_gate set habilitado=true where id;
set local role authenticated;
select lives_ok($$select pcm.sso_conferir_linha_autorizada('17810000-0000-0000-0000-000000000101','17810000-0000-0000-0000-00000000010a',1,'a','{"nome":"Area A"}')$$,'conferência autorizada');
select is((pcm.sso_conferir_linha_autorizada('17810000-0000-0000-0000-000000000101','17810000-0000-0000-0000-00000000010a',1,'a','{"nome":"Area A"}')->>'revision')::integer,2,'retry preserva revisão');
select throws_ok($$select pcm.sso_conferir_linha_autorizada('17810000-0000-0000-0000-000000000101','17810000-0000-0000-0000-00000000010a',1,'b','{"nome":"Local B"}')$$,'23505',null,'requestId com conteúdo diferente conflita');
select throws_ok($$select pcm.sso_conferir_linha_autorizada('17810000-0000-0000-0000-000000000105','17810000-0000-0000-0000-00000000010a',1,'b','{"nome":"Local B"}')$$,'40001',null,'revisão obsoleta bloqueada');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='17810000-0000-0000-0000-000000000001' and acao='cadastro.aprovar';
set local role authenticated;
select throws_ok($$select pcm.sso_conferir_linha_autorizada('17810000-0000-0000-0000-000000000101','17810000-0000-0000-0000-00000000010a',1,'a','{"nome":"Area A"}')$$,'42501',null,'revogação também impede retry');
reset role;
select * from finish();
rollback;
