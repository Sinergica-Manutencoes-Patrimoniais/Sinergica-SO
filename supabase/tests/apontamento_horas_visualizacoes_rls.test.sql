-- apontamento_horas_visualizacoes_rls.test.sql — pgTAP (E01-S92, parâmetros)
begin;
select plan(4);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000091","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is((select meta_diaria_horas from config.parametros_apontamento_horas where id = 1), 8::numeric, 'pcm leitura lê defaults');
select throws_ok($$ update config.parametros_apontamento_horas set meta_diaria_horas = 7 where id = 1 $$, '42501', null, 'pcm leitura não altera parâmetros');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000092","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select lives_ok($$ update config.parametros_apontamento_horas set meta_diaria_horas = 7.5, tolerancia_minutos = 20, limiar_anomalia_minutos = 6 where id = 1 $$, 'pcm escrita altera parâmetros');
select results_eq($$ select meta_diaria_horas, tolerancia_minutos, limiar_anomalia_minutos from config.parametros_apontamento_horas where id = 1 $$, $$ values (7.5::numeric, 20, 6) $$, 'parâmetros persistem juntos');

reset role;
select * from finish();
rollback;
