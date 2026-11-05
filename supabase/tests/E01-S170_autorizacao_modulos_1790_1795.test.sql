-- Exercício focado após as migrations 1790 e 1795. Não substitui ensaio de duas sessões.
begin;
select plan(12);

select is((select count(*)::integer from config.sso_acao_modulos m join (values
  ('orcamento.operacional.ler','comercial','leitura'),
  ('orcamento.dispensar','comercial','escrita'),
  ('orcamento.excecao_preco','comercial','escrita'),
  ('anexo_os.publicar','pcm','escrita')) e(acao,modulo,nivel)
  on (m.acao,m.modulo,m.nivel)=(e.acao,e.modulo,e.nivel)),4,'quatro elegibilidades declaradas existem');
select is(has_function_privilege('authenticated','config.sso_serializar_administracao_capacidades()','EXECUTE'),false,'helper permanece privado');
select is(has_function_privilege('anon','config.sso_definir_perfil(uuid,integer,uuid,text,boolean,text)','EXECUTE'),false,'anon não executa comando administrativo');
select is((select count(*)::integer from (values
  ('config.sso_definir_perfil(uuid,integer,uuid,text,boolean,text)'::regprocedure),
  ('config.sso_definir_vinculo_perfil(uuid,integer,uuid,uuid,boolean,text)'::regprocedure),
  ('config.sso_definir_concessao(uuid,integer,uuid,uuid,text,uuid,boolean,text)'::regprocedure)) f(oid)
  where position('config.sso_serializar_administracao_capacidades()' in pg_get_functiondef(f.oid))>0),3,'três comandos chamam trava de autorização');

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('17950000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s170-1795-operador@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('17950000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s170-1795-admin@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('17950000-0000-0000-0000-000000000001','colaborador','Operador 1795',true),
 ('17950000-0000-0000-0000-000000000002','superadmin','Admin 1795',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values
 ('17950000-0000-0000-0000-000000000001','comercial','escrita'),
 ('17950000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17950000-0000-0000-0000-00000000000a','Cliente A 1795',true,'17950000-0000-0000-0000-000000000002'),
 ('17950000-0000-0000-0000-00000000000b','Cliente B 1795',true,'17950000-0000-0000-0000-000000000002');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('17950000-0000-0000-0000-000000000001','orcamento.operacional.ler','17950000-0000-0000-0000-00000000000a'),
 ('17950000-0000-0000-0000-000000000001','orcamento.dispensar','17950000-0000-0000-0000-00000000000a'),
 ('17950000-0000-0000-0000-000000000001','orcamento.excecao_preco','17950000-0000-0000-0000-00000000000a'),
 ('17950000-0000-0000-0000-000000000001','anexo_os.publicar','17950000-0000-0000-0000-00000000000a');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17950000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
select is(config.sso_autorizar_acao('orcamento.operacional.ler','17950000-0000-0000-0000-00000000000a'),true,'concessão e módulo autorizam leitura comercial');
select is(config.sso_autorizar_acao('orcamento.dispensar','17950000-0000-0000-0000-00000000000a'),true,'concessão e módulo autorizam dispensa');
select is(config.sso_autorizar_acao('orcamento.excecao_preco','17950000-0000-0000-0000-00000000000a'),true,'concessão e módulo autorizam exceção');
select is(config.sso_autorizar_acao('anexo_os.publicar','17950000-0000-0000-0000-00000000000a'),true,'concessão e módulo autorizam publicação');
select is(config.sso_autorizar_acao('anexo_os.publicar','17950000-0000-0000-0000-00000000000b'),false,'concessão não atravessa Cliente');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='17950000-0000-0000-0000-000000000001' and acao='anexo_os.publicar';
set local role authenticated;
select is(config.sso_autorizar_acao('anexo_os.publicar','17950000-0000-0000-0000-00000000000a'),false,'revogação vale com sessão anterior');
set local request.jwt.claims = '{"sub":"17950000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin"}';
select lives_ok($$select config.sso_definir_perfil('17950000-0000-0000-0000-000000000101',0,'17950000-0000-0000-0000-000000000010','Perfil 1795',true,'Teste')$$,'administrador pode criar perfil');
reset role;
update config.usuarios set ativo=false where user_id='17950000-0000-0000-0000-000000000002';
set local role authenticated;
select throws_ok($$select config.sso_definir_perfil('17950000-0000-0000-0000-000000000101',0,'17950000-0000-0000-0000-000000000010','Perfil 1795',true,'Teste')$$,'42501',null,'replay não entrega recibo a administrador revogado');
select * from finish();
rollback;
