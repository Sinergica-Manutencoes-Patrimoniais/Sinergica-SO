-- E01-S196 / migration 1872 — a contingência Auvo precisa ser autorizável por quem NÃO é
-- superadmin. Antes da 1872 ela era negada para todo mundo, porque `config.sso_acoes` tinha a
-- linha e `config.sso_acao_modulos` não — e `sso_autorizar_acao` lê a elegibilidade da segunda.
-- O teste prova pelo par: `plano.gerir` e `execucao.contingencia_auvo` são ambas individuais, de
-- módulo `pcm`/`escrita`, concedidas ao mesmo usuário no mesmo Cliente. Se uma passa e a outra
-- não, a diferença só pode estar na elegibilidade de módulo.
begin;
select plan(6);

select is((select count(*)::integer from config.sso_acao_modulos
  where acao='execucao.contingencia_auvo' and modulo='pcm' and nivel='escrita'),1,
  'contingência Auvo tem elegibilidade de módulo declarada');

select is((select count(*)::integer from config.sso_acoes a
  where not exists (select 1 from config.sso_acao_modulos m where m.acao=a.codigo)),0,
  'nenhuma capacidade do catálogo ficou sem módulo elegível');

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18720000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s196-1872-gestor@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('18720000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s196-1872-admin@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('18720000-0000-0000-0000-000000000001','supervisor','Gestor PCM 1872',true),
 ('18720000-0000-0000-0000-000000000002','superadmin','Admin 1872',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values
 ('18720000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18720000-0000-0000-0000-00000000000a','Cliente 1872',true,'18720000-0000-0000-0000-000000000002'),
 ('18720000-0000-0000-0000-00000000000b','Outro Cliente 1872',true,'18720000-0000-0000-0000-000000000002');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('18720000-0000-0000-0000-000000000001','plano.gerir','18720000-0000-0000-0000-00000000000a'),
 ('18720000-0000-0000-0000-000000000001','execucao.contingencia_auvo','18720000-0000-0000-0000-00000000000a');

set local role authenticated;
set local request.jwt.claims = '{"sub":"18720000-0000-0000-0000-000000000001","role":"authenticated","user_role":"supervisor"}';
select is(config.sso_autorizar_acao('plano.gerir','18720000-0000-0000-0000-00000000000a'),true,
  'controle: gestão de Plano autoriza com concessão nominal');
select is(config.sso_autorizar_acao('execucao.contingencia_auvo','18720000-0000-0000-0000-00000000000a'),true,
  'contingência Auvo autoriza para quem não é superadmin');
select is(pcm.sso_autorizar_contingencia_auvo('18720000-0000-0000-0000-00000000000a'),true,
  'a checagem isolada que a tela chama concorda');
select is(config.sso_autorizar_acao('execucao.contingencia_auvo','18720000-0000-0000-0000-00000000000b'),false,
  'contingência não atravessa Cliente');
reset role;

select * from finish();
rollback;
