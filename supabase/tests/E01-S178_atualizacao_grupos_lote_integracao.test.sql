-- Fixture transacional; não é execução de teste nem usa rede/Auvo.
begin;
set local app.auvo_sync_write='true';
select plan(11);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17898000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s178-grupos-integracao@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17898000-0000-4000-8000-000000000001','superadmin','Lote sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values('17898000-0000-4000-8000-000000000002','Cliente sintético',true,'17898000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17898000-0000-4000-8000-000000000001','cadastro.aprovar','17898000-0000-4000-8000-000000000002');
insert into pcm.areas(id,cliente_id,nome) values('17898000-0000-4000-8000-000000000003','17898000-0000-4000-8000-000000000002','Área sintética');
insert into pcm.locais(id,area_id,nome) values('17898000-0000-4000-8000-000000000004','17898000-0000-4000-8000-000000000003','Local sintético');
insert into pcm.equipamento_categorias(id,nome) values('17898000-0000-4000-8000-000000000005','Categoria sintética lote');
insert into pcm.grupos_quantitativos(id,cliente_id,local_id,categoria_id,nome,quantidade,created_by,updated_by) values
 ('17898000-0000-4000-8000-000000000010','17898000-0000-4000-8000-000000000002','17898000-0000-4000-8000-000000000004','17898000-0000-4000-8000-000000000005','Grupo A anterior',1,'17898000-0000-4000-8000-000000000001','17898000-0000-4000-8000-000000000001'),
 ('17898000-0000-4000-8000-000000000011','17898000-0000-4000-8000-000000000002','17898000-0000-4000-8000-000000000004','17898000-0000-4000-8000-000000000005','Grupo B anterior',2,'17898000-0000-4000-8000-000000000001','17898000-0000-4000-8000-000000000001');
insert into pcm.sso_codigos_grupo_quantitativo(grupo_id,cliente_id,codigo,request_id,ator_id) values
 ('17898000-0000-4000-8000-000000000010','17898000-0000-4000-8000-000000000002','GRUPO-LOTE-A','17898000-0000-4000-8000-000000000020','17898000-0000-4000-8000-000000000001'),
 ('17898000-0000-4000-8000-000000000011','17898000-0000-4000-8000-000000000002','GRUPO-LOTE-B','17898000-0000-4000-8000-000000000021','17898000-0000-4000-8000-000000000001');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,revisao,criado_por)
values('17898000-0000-4000-8000-000000000006','17898000-0000-4000-8000-000000000002','planilha','grupos-lote-integrado','[]',4,'17898000-0000-4000-8000-000000000001');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values
 ('17898000-0000-4000-8000-000000000006','a','grupo_quantitativo','{"nome":"Grupo A novo","quantidade":"3","codigoInformado":"GRUPO-LOTE-A"}'),
 ('17898000-0000-4000-8000-000000000006','b','grupo_quantitativo','{"nome":"Grupo B novo","quantidade":"4","codigoInformado":"GRUPO-LOTE-B"}');
insert into pcm.sso_conferencia_linhas(lote_id,linha_chave,revisao,ator_id,request_id,atributos) values
 ('17898000-0000-4000-8000-000000000006','a',2,'17898000-0000-4000-8000-000000000001','17898000-0000-4000-8000-000000000022','{"nome":"Grupo A novo","quantidade":"3","codigoInformado":"GRUPO-LOTE-A"}'),
 ('17898000-0000-4000-8000-000000000006','b',3,'17898000-0000-4000-8000-000000000001','17898000-0000-4000-8000-000000000023','{"nome":"Grupo B novo","quantidade":"4","codigoInformado":"GRUPO-LOTE-B"}');
insert into pcm.sso_conferencia_lotes(lote_id,revisao,ator_id,request_id,total) values
 ('17898000-0000-4000-8000-000000000006',4,'17898000-0000-4000-8000-000000000001','17898000-0000-4000-8000-000000000024',2);
update pcm.sso_atualizacao_grupos_lote_gate set habilitado=true where id;
update pcm.sso_preservar_caracteristicas_grupo_gate set habilitado=true where id;
update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;
update pcm.sso_incorporacao_aprovacao_gate set habilitado=true where id;
update pcm.sso_levantamento_ativos_gate set habilitado=true where chave;
update pcm.sso_validar_atributos_grupo_importado_gate set habilitado=true where id;
create temporary table s178_payloads(ruim jsonb, bom jsonb) on commit drop;
insert into s178_payloads values (
 '[{"chave":"a","grupoId":"17898000-0000-4000-8000-000000000010","grupoRevision":1,"localId":"17898000-0000-4000-8000-000000000004","atributos":{"nome":"Grupo A novo","quantidade":"3","codigoInformado":"GRUPO-LOTE-A"},"caracteristicas":{},"codigoStaging":null,"codigoRevision":0,"motivo":"Conferido","requestId":"17898000-0000-4000-8000-000000000031"},{"chave":"b","grupoId":"17898000-0000-4000-8000-000000000011","grupoRevision":99,"localId":"17898000-0000-4000-8000-000000000004","atributos":{"nome":"Grupo B novo","quantidade":"4","codigoInformado":"GRUPO-LOTE-B"},"caracteristicas":{},"codigoStaging":null,"codigoRevision":0,"motivo":"Conferido","requestId":"17898000-0000-4000-8000-000000000032"}]',
 '[{"chave":"a","grupoId":"17898000-0000-4000-8000-000000000010","grupoRevision":1,"localId":"17898000-0000-4000-8000-000000000004","atributos":{"nome":"Grupo A novo","quantidade":"3","codigoInformado":"GRUPO-LOTE-A"},"caracteristicas":{},"codigoStaging":null,"codigoRevision":0,"motivo":"Conferido","requestId":"17898000-0000-4000-8000-000000000031"},{"chave":"b","grupoId":"17898000-0000-4000-8000-000000000011","grupoRevision":1,"localId":"17898000-0000-4000-8000-000000000004","atributos":{"nome":"Grupo B novo","quantidade":"4","codigoInformado":"GRUPO-LOTE-B"},"caracteristicas":{},"codigoStaging":null,"codigoRevision":0,"motivo":"Conferido","requestId":"17898000-0000-4000-8000-000000000032"}]');
grant select on s178_payloads to authenticated;
set local request.jwt.claims='{"sub":"17898000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_atualizar_grupos_lote('17898000-0000-4000-8000-000000000030','17898000-0000-4000-8000-000000000006',4,(select ruim from s178_payloads))$$,'40001','grupo_revisao_obsoleta','falha do segundo Grupo reverte seleção');
reset role;
select is((select nome from pcm.grupos_quantitativos where id='17898000-0000-4000-8000-000000000010'),'Grupo A anterior','primeiro Grupo permanece intacto');
select is((select revisao from pcm.sso_levantamentos where id='17898000-0000-4000-8000-000000000006'),4,'revisão do lote foi revertida');
select is((select count(*)::int from pcm.sso_levantamento_incorporacoes where lote_id='17898000-0000-4000-8000-000000000006'),0,'nenhum vínculo parcial foi gravado');
select is((select count(*)::int from pcm.sso_codigos_grupo_quantitativo where codigo in ('GRUPO-LOTE-A','GRUPO-LOTE-B') and atual),2,'códigos permanecem atuais');
set local role authenticated;
select lives_ok($$select pcm.sso_atualizar_grupos_lote('17898000-0000-4000-8000-000000000030','17898000-0000-4000-8000-000000000006',4,(select bom from s178_payloads))$$,'duas atualizações conferidas são aceitas');
select lives_ok($$select pcm.sso_atualizar_grupos_lote('17898000-0000-4000-8000-000000000030','17898000-0000-4000-8000-000000000006',4,(select bom from s178_payloads))$$,'repetição usa recibo original');
reset role;
select is((select quantidade from pcm.grupos_quantitativos where id='17898000-0000-4000-8000-000000000010'),3::bigint,'quantidade do Grupo A atualizada');
select is((select quantidade from pcm.grupos_quantitativos where id='17898000-0000-4000-8000-000000000011'),4::bigint,'quantidade do Grupo B atualizada');
select is((select count(*)::int from pcm.sso_levantamento_incorporacoes where lote_id='17898000-0000-4000-8000-000000000006'),2,'replay não duplica vínculos');
select is((select count(*)::int from pcm.sso_codigos_grupo_quantitativo where codigo in ('GRUPO-LOTE-A','GRUPO-LOTE-B') and atual),2,'atualização não troca códigos');
select * from finish();
rollback;
