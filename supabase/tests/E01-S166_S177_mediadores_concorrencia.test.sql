-- Duas conexões ao mesmo banco descartável; nenhuma autorização persiste.
\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path=extensions,public;
select plan(3);
grant execute on function pcm.sso_localizar_codigo_publico_mediada(uuid,uuid,text), pcm.sso_listar_aliases_ativo_mediada(uuid,uuid,text,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_pcm_gerar_visita_suprimivel(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) to authenticated;
set local request.jwt.claims='{"sub":"17910000-0000-0000-0000-000000000001","role":"authenticated"}';
select extensions.dblink_connect('s177_autorizacao',format('hostaddr=%s port=%s dbname=%L user=postgres password=postgres connect_timeout=5',inet_server_addr(),inet_server_port(),current_database()));
select extensions.dblink_exec('s177_autorizacao','begin');
select extensions.dblink_exec('s177_autorizacao',$remote$do $block$ begin if not pg_try_advisory_xact_lock(hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'trava indisponível'; end if; end $block$$remote$);
set local role authenticated;
select throws_ok($$select pcm.sso_localizar_codigo_publico_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','TESTE')$$,'55P03','autorizacao_em_alteracao','busca falha fechada durante alteração de autorização');
select throws_ok($$select * from pcm.sso_listar_aliases_ativo_mediada('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-00000000000a','sistema','17910000-0000-0000-0000-000000000011',null,20)$$,'55P03','autorizacao_em_alteracao','lista falha fechada durante alteração de autorização');
select throws_ok($$select pcm.sso_pcm_gerar_visita_suprimivel('17910000-0000-0000-0000-000000000001','17910000-0000-0000-0000-000000000002','17910000-0000-0000-0000-00000000000a','17910000-0000-0000-0000-000000000020','17910000-0000-0000-0000-000000000021','2026-10-05','17910000-0000-0000-0000-000000000022','2026-10-09 08:00+00',null,'Teste')$$,'55P03','autorizacao_em_alteracao','geração falha fechada durante alteração de autorização');
reset role;
select extensions.dblink_exec('s177_autorizacao','rollback');
select extensions.dblink_disconnect('s177_autorizacao');
select * from finish();
rollback;
