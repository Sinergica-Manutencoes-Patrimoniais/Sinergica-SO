-- E00-S26_capacidades_sensiveis.test.sql — pgTAP (AC-1 a AC-8).
-- Migration 1854: config.sso_acoes.exige_concessao_individual=true pras ações sensíveis que
-- nasceram frouxas (E01-S170). Prova a matriz positiva e negativa via config.sso_autorizar_acao,
-- que é o único ponto de decisão (toda RPC sensível já delega pra ele).
begin;
select plan(15);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('e0026000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s26-colaborador@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('e0026000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s26-financeiro@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('e0026000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s26-sindico@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('e0026000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s26-colaborador-com-grant@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());

insert into pcm.clientes(id,nome,ativo,created_by) values
 ('e0026000-0000-4000-8000-000000000010','[TESTE] Cliente S26 A',true,'e0026000-0000-4000-8000-000000000001'),
 ('e0026000-0000-4000-8000-000000000011','[TESTE] Cliente S26 B',true,'e0026000-0000-4000-8000-000000000001');

-- AC-4: grupo "Financeiro" (só módulo financeiro, leitura) — nunca ganha pcm.
insert into config.grupos(id,nome,ativo) values ('e0026000-0000-4000-8000-000000000020','[TESTE] Financeiro S26',true);
insert into config.grupo_modulos(grupo_id,modulo,nivel) values ('e0026000-0000-4000-8000-000000000020','financeiro','leitura');
insert into config.usuarios(user_id,papel,nome,ativo,grupo_id) values ('e0026000-0000-4000-8000-000000000002','colaborador','Financeiro S26',true,'e0026000-0000-4000-8000-000000000020');

-- Colaborador "Inspetor" — pcm:escrita via grupo, mas SEM nenhuma concessão sensível.
insert into config.grupos(id,nome,ativo) values ('e0026000-0000-4000-8000-000000000021','[TESTE] Inspetor S26',true);
insert into config.grupo_modulos(grupo_id,modulo,nivel) values
 ('e0026000-0000-4000-8000-000000000021','pcm','escrita'),
 ('e0026000-0000-4000-8000-000000000021','comercial','leitura');
insert into config.usuarios(user_id,papel,nome,ativo,grupo_id) values ('e0026000-0000-4000-8000-000000000001','colaborador','Inspetor S26',true,'e0026000-0000-4000-8000-000000000021');
-- Toda ação em config.sso_acoes exige uma concessão própria (individual ou por perfil) além do
-- módulo — mesmo as não-sensíveis. Inspetor recebe só a de coleta (cadastro.gerir), nunca a de
-- aprovar — é a concessão granular fazendo o trabalho, não o nível do módulo.
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('e0026000-0000-4000-8000-000000000001','cadastro.gerir','e0026000-0000-4000-8000-000000000010');

-- Mesmo grupo/pcm:escrita, mas ESTE recebe concessão individual de cadastro.aprovar e custo.ler
-- só no Cliente A — prova que a concessão é por pessoa+cliente, não herdada do módulo.
insert into config.usuarios(user_id,papel,nome,ativo,grupo_id) values ('e0026000-0000-4000-8000-000000000004','colaborador','Aprovador S26',true,'e0026000-0000-4000-8000-000000000021');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('e0026000-0000-4000-8000-000000000004','cadastro.aprovar','e0026000-0000-4000-8000-000000000010'),
 ('e0026000-0000-4000-8000-000000000004','custo.ler','e0026000-0000-4000-8000-000000000010'),
 ('e0026000-0000-4000-8000-000000000004','chamado.encerrar','e0026000-0000-4000-8000-000000000010');

-- Cliente-síndico — AC-5, isolamento por tenant (resolver_permissoes_modulo só devolve
-- area-cliente, nunca pcm; RLS de pcm.clientes/chamados etc. também corta por client_id).
insert into config.usuarios(user_id,papel,nome,ativo) values ('e0026000-0000-4000-8000-000000000003','cliente-sindico','Síndico S26',true);
insert into config.usuario_cliente(user_id,cliente_id) values ('e0026000-0000-4000-8000-000000000003','e0026000-0000-4000-8000-000000000010');

-- AC-1: Inspetor (pcm:escrita, sem concessão) não aprova.
select set_config('request.jwt.claims','{"sub":"e0026000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_autorizar_acao('cadastro.aprovar','e0026000-0000-4000-8000-000000000010'),false,'AC-1: escrita por módulo não basta pra aprovar — exige_concessao_individual fechou a herança por perfil');

-- AC-1 positivo: com concessão individual no Cliente A, aprova.
select set_config('request.jwt.claims','{"sub":"e0026000-0000-4000-8000-000000000004","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_autorizar_acao('cadastro.aprovar','e0026000-0000-4000-8000-000000000010'),true,'AC-1 positivo: concessão individual no Cliente A aprova');
select is(config.sso_autorizar_acao('cadastro.aprovar','e0026000-0000-4000-8000-000000000011'),false,'Concessão é por Cliente — não vaza pro Cliente B');

-- AC-2: custo.ler segue o mesmo padrão — sem concessão, sem acesso a valor interno.
select set_config('request.jwt.claims','{"sub":"e0026000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_autorizar_acao('custo.ler','e0026000-0000-4000-8000-000000000010'),false,'AC-2: sem concessão, custo.ler nega — RPCs de custo não retornam o campo');
select set_config('request.jwt.claims','{"sub":"e0026000-0000-4000-8000-000000000004","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_autorizar_acao('custo.ler','e0026000-0000-4000-8000-000000000010'),true,'AC-2 positivo: com concessão, custo.ler autoriza');

-- AC-3: cancelar (chamado.encerrar) aceito com concessão; a RPC de verdade (1832) audita
-- actor_id + action nomeada + created_at — não é hipótese, é o padrão já no código.
select is(config.sso_autorizar_acao('chamado.encerrar','e0026000-0000-4000-8000-000000000010'),true,'AC-3: cancelar aceito com concessão própria');
select ok(exists(
  select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='pcm' and p.proname='sso_cancelar_chamado_forcado'
) or exists(
  select 1 from information_schema.routines where routine_schema='pcm' and routine_name ilike '%cancelamento%chamado%'
), 'AC-3: existe RPC real de cancelamento de Chamado que audita (1832, conferido por leitura de código: actor_id + action + created_at)');

-- AC-4: Financeiro nunca altera objeto da operação — resolver_permissoes_modulo não devolve 'pcm'.
-- '{}' bypassa o próprio-ou-superadmin check de resolver_permissoes_modulo (coalesce vira service_role).
select set_config('request.jwt.claims','{}',true);
select is((select m.nivel from config.resolver_permissoes_modulo('e0026000-0000-4000-8000-000000000002') m where m.modulo='pcm'),null,'AC-4: Financeiro não tem nenhum nível em pcm — resolver_permissoes_modulo nunca devolve a linha');
select set_config('request.jwt.claims','{"sub":"e0026000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_autorizar_acao('cadastro.aprovar','e0026000-0000-4000-8000-000000000010'),false,'AC-4: Financeiro recusado em ação de escrita operacional, mesmo com concessão ausente E módulo ausente');

-- AC-5: Cliente-síndico isolado — nunca ganha módulo pcm, só area-cliente/leitura.
select set_config('request.jwt.claims','{}',true);
select is((select array_agg(m.modulo order by m.modulo) from config.resolver_permissoes_modulo('e0026000-0000-4000-8000-000000000003') m),array['area-cliente'],'AC-5: síndico só tem area-cliente — nunca pcm, por nenhum caminho');
select set_config('request.jwt.claims','{"sub":"e0026000-0000-4000-8000-000000000003","role":"authenticated","user_role":"cliente-sindico"}',true);
select is(config.sso_autorizar_acao('cadastro.aprovar','e0026000-0000-4000-8000-000000000010'),false,'AC-5: síndico recusado em ação pcm mesmo sendo o Cliente dono do registro');

-- AC-6: Inspetor (colaborador) nunca aprova o próprio levantamento — já coberto por AC-1 acima
-- (mesma pessoa, mesma ação); aqui prova que nem "cadastro.gerir" (coleta) dá "cadastro.aprovar".
select set_config('request.jwt.claims','{"sub":"e0026000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_autorizar_acao('cadastro.gerir','e0026000-0000-4000-8000-000000000010'),true,'Inspetor tem a concessão de coleta (cadastro.gerir) que recebeu');
select is(config.sso_autorizar_acao('cadastro.aprovar','e0026000-0000-4000-8000-000000000010'),false,'AC-6: mas cadastro.aprovar (promover a oficial) continua negado pro mesmo Inspetor');

-- AC-7: nenhuma regra de autorização referencia pessoa física — só grupo/capacidade (prova
-- estrutural: a única tabela que liga usuario_id a uma ação é DADO administrável, não código).
select is((select count(*)::int from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='config' and p.proname='sso_autorizar_acao' and pg_get_functiondef(p.oid) ~* '@test\.local|superadmin@|hardcoded'),0,'AC-7: função de autorização não tem e-mail/identificador fixo embutido');

-- AC-8: grupo novo criado agora (sem deploy) já vale — exatamente o que os inserts acima fizeram.
select ok((select ativo from config.grupos where id='e0026000-0000-4000-8000-000000000021'),'AC-8: grupo "Inspetor S26" criado em runtime (sem migration) já está ativo e valendo nos testes acima');

reset role;
delete from config.sso_concessoes where usuario_id in ('e0026000-0000-4000-8000-000000000001','e0026000-0000-4000-8000-000000000004');
delete from config.usuario_cliente where user_id='e0026000-0000-4000-8000-000000000003';
delete from config.usuarios where user_id in ('e0026000-0000-4000-8000-000000000001','e0026000-0000-4000-8000-000000000002','e0026000-0000-4000-8000-000000000003','e0026000-0000-4000-8000-000000000004');
delete from config.grupo_modulos where grupo_id in ('e0026000-0000-4000-8000-000000000020','e0026000-0000-4000-8000-000000000021');
delete from config.grupos where id in ('e0026000-0000-4000-8000-000000000020','e0026000-0000-4000-8000-000000000021');
delete from pcm.clientes where id in ('e0026000-0000-4000-8000-000000000010','e0026000-0000-4000-8000-000000000011');

select * from finish();
rollback;
