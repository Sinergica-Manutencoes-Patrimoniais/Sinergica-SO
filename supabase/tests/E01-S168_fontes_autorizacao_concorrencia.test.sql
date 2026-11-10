-- Somente Supabase local descartável, com credencial padrão local de teste.
\set ON_ERROR_STOP on
begin;
create extension if not exists dblink with schema extensions;
select extensions.dblink_connect('s168_fontes',format('hostaddr=%s port=%s dbname=%L user=postgres password=postgres connect_timeout=5',inet_server_addr(),inet_server_port(),current_database()));
select extensions.dblink_exec('s168_fontes','begin');
select extensions.dblink_exec('s168_fontes',$remote$do $block$ begin if not pg_try_advisory_xact_lock_shared(hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'trava de teste indisponível'; end if; end $block$$remote$);
select plan(10);
set local lock_timeout = '250ms';
select throws_ok($$update config.usuarios set ativo=ativo where false$$,'55P03',null,'usuário aguarda trava');
select throws_ok($$update config.sso_acoes set codigo=codigo where false$$,'55P03',null,'ação aguarda trava');
select throws_ok($$update pcm.clientes set ativo=ativo where false$$,'55P03',null,'cliente aguarda trava');
select throws_ok($$update config.sso_acao_modulos set nivel=nivel where false$$,'55P03',null,'ação módulo aguarda trava');
select throws_ok($$update config.sso_concessoes set ativa=ativa where false$$,'55P03',null,'concessão aguarda trava');
select throws_ok($$update config.sso_usuario_perfis set ativo=ativo where false$$,'55P03',null,'associação perfil aguarda trava');
select throws_ok($$update config.sso_perfis set ativo=ativo where false$$,'55P03',null,'perfil aguarda trava');
select throws_ok($$update config.usuario_modulos set nivel=nivel where false$$,'55P03',null,'módulo usuário aguarda trava');
select throws_ok($$update config.grupos set ativo=ativo where false$$,'55P03',null,'grupo aguarda trava');
select throws_ok($$update config.grupo_modulos set nivel=nivel where false$$,'55P03',null,'módulo grupo aguarda trava');
select extensions.dblink_exec('s168_fontes','rollback');
select extensions.dblink_disconnect('s168_fontes');
select * from finish();
rollback;
