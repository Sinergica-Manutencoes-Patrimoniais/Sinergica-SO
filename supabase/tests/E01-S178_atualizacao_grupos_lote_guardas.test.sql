-- Verificações iniciais da fronteira. A prova de rollback com dois Grupos exige fixture integrada adicional.
begin;
set local app.auvo_sync_write='true';
select plan(6);
select ok(has_function_privilege('authenticated','pcm.sso_atualizar_grupos_lote(uuid,uuid,integer,jsonb)','execute'),'comando tem entrada autenticada');
select throws_ok($$select pcm.sso_atualizar_grupos_lote(null,null,null,null)$$,'55000','atualizacao_lote_desabilitada','gate fechado recusa operação');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17897000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-grupos-lote@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17897000-0000-4000-8000-000000000001','superadmin','Lote sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values('17897000-0000-4000-8000-000000000002','Cliente sintético lote',true,'17897000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17897000-0000-4000-8000-000000000001','cadastro.aprovar','17897000-0000-4000-8000-000000000002');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,revisao,criado_por)
values('17897000-0000-4000-8000-000000000003','17897000-0000-4000-8000-000000000002','planilha','lote-sintetico-grupos','[]',1,'17897000-0000-4000-8000-000000000001');
update pcm.sso_atualizacao_grupos_lote_gate set habilitado=true where id;
update pcm.sso_preservar_caracteristicas_grupo_gate set habilitado=true where id;
update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17897000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_atualizar_grupos_lote('17897000-0000-4000-8000-000000000004','17897000-0000-4000-8000-000000000003',1,'[]')$$,
  '22023','quantidade_invalida','lote vazio é recusado');
select throws_ok($$select pcm.sso_atualizar_grupos_lote('17897000-0000-4000-8000-000000000004','17897000-0000-4000-8000-000000000003',1,
 '[{"chave":"a","grupoId":"17897000-0000-4000-8000-000000000010","grupoRevision":1,"localId":"17897000-0000-4000-8000-000000000020","atributos":{},"caracteristicas":{},"codigoStaging":null,"codigoRevision":0,"motivo":"conferido","requestId":"17897000-0000-4000-8000-000000000030"},
   {"chave":"b","grupoId":"17897000-0000-4000-8000-000000000010","grupoRevision":1,"localId":"17897000-0000-4000-8000-000000000020","atributos":{},"caracteristicas":{},"codigoStaging":null,"codigoRevision":0,"motivo":"conferido","requestId":"17897000-0000-4000-8000-000000000031"}]')$$,
  '22023','itens_duplicados_ou_fora_de_ordem','mesmo Grupo não aparece duas vezes');
reset role;
select is((select revisao from pcm.sso_levantamentos where id='17897000-0000-4000-8000-000000000003'),1,'rejeições não alteram revisão do lote');
select is((select count(*)::int from pcm.sso_levantamento_comandos where request_id='17897000-0000-4000-8000-000000000004'),0,'rejeições não gravam recibo');
select * from finish();
rollback;
