-- AC-9/AC-10: tipos, localização e pertencimento não se confundem.
begin;
select plan(22);
insert into auth.users(id,email) values ('19010000-0000-4000-8000-000000000001','s190-busca@test.local');
insert into config.usuarios(user_id,papel,nome,ativo) values ('19010000-0000-4000-8000-000000000001','superadmin','Busca S190',true);
insert into pcm.clientes(id,nome,created_by) values
 ('19010000-0000-4000-8000-000000000010','[S190] Cliente','19010000-0000-4000-8000-000000000001'),
 ('19010000-0000-4000-8000-000000000011','[S190] Outro','19010000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('19010000-0000-4000-8000-000000000001','cadastro.ler','19010000-0000-4000-8000-000000000010');
insert into pcm.areas(id,cliente_id,nome) values ('19010000-0000-4000-8000-000000000020','19010000-0000-4000-8000-000000000010','Área técnica');
insert into pcm.locais(id,area_id,nome) values ('19010000-0000-4000-8000-000000000030','19010000-0000-4000-8000-000000000020','Sala técnica');
insert into pcm.equipamento_categorias(id,nome) values ('19010000-0000-4000-8000-000000000040','[S190] Categoria');
insert into pcm.sistemas(id,cliente_id,nome,local_id) values ('19010000-0000-4000-8000-000000000050','19010000-0000-4000-8000-000000000010','Climatização','19010000-0000-4000-8000-000000000030');
insert into pcm.equipamentos(id,client_id,nome,tipo,local_id,identificador) values
 ('19010000-0000-4000-8000-000000000060','19010000-0000-4000-8000-000000000010','Máquina','equipamento','19010000-0000-4000-8000-000000000030','S190-MAQ');
insert into pcm.equipamentos(id,client_id,nome,tipo,local_id,parent_item_id) values
 ('19010000-0000-4000-8000-000000000061','19010000-0000-4000-8000-000000000010','Sensor','componente','19010000-0000-4000-8000-000000000030','19010000-0000-4000-8000-000000000060');
insert into pcm.sistema_itens(sistema_id,item_id) values ('19010000-0000-4000-8000-000000000050','19010000-0000-4000-8000-000000000060');
insert into pcm.grupos_quantitativos(id,cliente_id,local_id,categoria_id,sistema_id,nome,quantidade,created_by,updated_by) values
 ('19010000-0000-4000-8000-000000000070','19010000-0000-4000-8000-000000000010','19010000-0000-4000-8000-000000000030','19010000-0000-4000-8000-000000000040','19010000-0000-4000-8000-000000000050','Filtros',4,'19010000-0000-4000-8000-000000000001','19010000-0000-4000-8000-000000000001');
insert into pcm.sso_codigos_grupo_quantitativo(grupo_id,cliente_id,codigo,request_id,ator_id) values
 ('19010000-0000-4000-8000-000000000070','19010000-0000-4000-8000-000000000010','S190-FILTROS','19010000-0000-4000-8000-000000000080','19010000-0000-4000-8000-000000000001');
select has_function('pcm','sso_pesquisar_estrutura',array['uuid','text','text','text','uuid','text','integer'],'RPC existe');
set local role authenticated;
set local request.jwt.claims = '{"sub":"19010000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin","user_modulos":{"pcm":"escrita"}}';
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010')),6,'AC-9: seis tipos separados');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','maquina')),1,'busca ignora acentos');
select is(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','S190-FILTROS')->0->>'tipo','grupo_quantitativo','código atual do Grupo pesquisável');
select is(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','S190-MAQ')->0->>'tipo','equipamento','TAG preserva tipo Equipamento');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','local')),1,'filtro por tipo');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','','area','19010000-0000-4000-8000-000000000020')),1,'AC-10: Área abre Local');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','','sistema','19010000-0000-4000-8000-000000000050')),2,'Sistema abre Equipamento e Grupo por vínculo funcional');
select is(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','','equipamento','19010000-0000-4000-8000-000000000060')->0->>'tipo','componente','Equipamento abre filho Componente');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','',null,null,null,2)),2,'limite respeitado');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','%')),0,'metacaractere é texto literal');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','',null,null,
 pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','',null,null,null,2)->1->>'chave',2)),2,'página seguinte tem limite e cursor estável');
select isnt(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','',null,null,null,2)->0->>'chave',
 pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','',null,null,
 pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','',null,null,null,2)->1->>'chave',2)->0->>'chave','cursor não repete primeira página');
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','','local','19010000-0000-4000-8000-000000000099')),0,'contexto inexistente não expõe outro cadastro');

select throws_ok($$select pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000011')$$,'42501',null,'outro Cliente recusado');
select throws_ok($$select pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','',null,null,null,101)$$,'22023',null,'limite abusivo recusado');
select throws_ok($$select pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010','','','local',null)$$,'22023',null,'contexto incompleto recusado');
reset role;
insert into config.grupos(id,nome,ativo) values('19010000-0000-4000-8000-000000000090','[S190] PCM leitura',true);
insert into config.grupo_modulos(grupo_id,modulo,nivel) values('19010000-0000-4000-8000-000000000090','pcm','leitura');
update config.usuarios set papel='colaborador',grupo_id='19010000-0000-4000-8000-000000000090' where user_id='19010000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims='{"sub":"19010000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is(jsonb_array_length(pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010')),6,'perfil real PCM leitura e concessão também pesquisa');
reset role;
delete from config.grupo_modulos where grupo_id='19010000-0000-4000-8000-000000000090' and modulo='pcm';
set local role authenticated;
select throws_ok($$select pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010')$$,'42501',null,'revogar módulo bloqueia mesmo com claim antigo e concessão válida');
reset role;
insert into config.grupo_modulos(grupo_id,modulo,nivel) values('19010000-0000-4000-8000-000000000090','pcm','leitura');
update config.usuarios set ativo=false where user_id='19010000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select pcm.sso_pesquisar_estrutura('19010000-0000-4000-8000-000000000010')$$,'42501',null,'revogação imediata apesar de token válido');
reset role;
select ok(not has_function_privilege('anon','pcm.sso_pesquisar_estrutura(uuid,text,text,text,uuid,text,integer)','execute'),'anon sem EXECUTE');
select ok(not has_function_privilege('service_role','pcm.sso_pesquisar_estrutura(uuid,text,text,text,uuid,text,integer)','execute'),'service_role sem EXECUTE');
select * from finish();
rollback;

