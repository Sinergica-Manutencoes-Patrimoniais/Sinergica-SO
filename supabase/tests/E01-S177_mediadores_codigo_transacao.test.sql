-- Ensaio de mediadores com concessão e gates temporários; rollback obrigatório.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(10);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17910000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mediador-s177@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17910000-0000-0000-0000-000000000001','colaborador','Teste mediado',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17910000-0000-0000-0000-000000000001','pcm','leitura');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17910000-0000-0000-0000-00000000000a','Cliente A',true,'17910000-0000-0000-0000-000000000001'),
 ('17910000-0000-0000-0000-00000000000b','Cliente B',true,'17910000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17910000-0000-0000-0000-000000000001','cadastro.ler','17910000-0000-0000-0000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17910000-0000-0000-0000-000000000011','17910000-0000-0000-0000-00000000000a','Sistema A','TESTE-MEDIADO-ATUAL');
insert into pcm.sso_codigo_aliases(id,cliente_id,sistema_id,codigo,criado_por,motivo) values ('17910000-0000-0000-0000-000000000021','17910000-0000-0000-0000-00000000000a','17910000-0000-0000-0000-000000000011','TESTE-MEDIADO-ANTIGO','17910000-0000-0000-0000-000000000001','teste');
grant execute on function pcm.sso_localizar_codigo_publico_mediada(uuid,uuid,text), pcm.sso_listar_aliases_ativo_mediada(uuid,uuid,text,uuid,uuid,integer) to authenticated;
set local request.jwt.claims = '{"sub":"17910000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok($$select pcm.sso_localizar_codigo_publico_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','TESTE-MEDIADO-ANTIGO')$$,'55000','busca_codigo_desabilitada','busca bloqueada por padrão');
select throws_ok($$select * from pcm.sso_listar_aliases_ativo_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','sistema','17910000-0000-0000-0000-000000000011',null,20)$$,'55000','leitura_aliases_desabilitada','lista bloqueada por padrão');
reset role;
update pcm.sso_busca_codigo_mediada_gate set habilitado=true where id;
update pcm.sso_leitura_aliases_mediada_gate set habilitado=true where id;
update pcm.sso_listagem_aliases_gate set habilitado=true where id;
set local role authenticated;
select is(pcm.sso_localizar_codigo_publico_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','TESTE-MEDIADO-ANTIGO')->>'ativoId','17910000-0000-0000-0000-000000000011','busca alias no Cliente autorizado');
select is(pcm.sso_localizar_codigo_publico_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','TESTE-MEDIADO-ATUAL')->>'ativoId','17910000-0000-0000-0000-000000000011','busca código atual');
select is((select codigo from pcm.sso_listar_aliases_ativo_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','sistema','17910000-0000-0000-0000-000000000011',null,20)),'TESTE-MEDIADO-ANTIGO','lista código anterior');
select throws_ok($$select pcm.sso_localizar_codigo_publico_mediada('17910000-0000-0000-0000-000000000002','17910000-0000-0000-0000-00000000000a','TESTE-MEDIADO-ATUAL')$$,'42501','sessao_invalida','ator divergente negado');
select throws_ok($$select pcm.sso_localizar_codigo_publico_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000b','TESTE-MEDIADO-ATUAL')$$,'42501',null,'outro Cliente negado');
select throws_ok($$select * from pcm.sso_listar_aliases_ativo_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','sistema','17910000-0000-0000-0000-000000000011',null,0)$$,'22023',null,'limite inválido negado');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='17910000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select pcm.sso_localizar_codigo_publico_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','TESTE-MEDIADO-ATUAL')$$,'42501',null,'revogação impede busca');
select throws_ok($$select * from pcm.sso_listar_aliases_ativo_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','sistema','17910000-0000-0000-0000-000000000011',null,20)$$,'42501',null,'revogação impede lista');
reset role;
select * from finish();
rollback;
