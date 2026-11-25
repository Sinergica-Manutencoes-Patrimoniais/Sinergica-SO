begin;
-- E00-S30: a migration 1872 abriu estes gates na linha de base do banco. As asserções abaixo
-- provam o comportamento de gate FECHADO, então o teste declara aqui, dentro da própria
-- transação, o estado de que precisa (o `rollback` do fim desfaz). Onde o teste reabre o gate
-- mais adiante, a abertura continua valendo.
update financeiro.sso_relatorio_despesas_mediado_gate set habilitado = false where id;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(7);
select ok(not (select habilitado from financeiro.sso_relatorio_despesas_mediado_gate where id), 'gate declarado fechado nesta transação');
select ok(not has_function_privilege('anon','financeiro.sso_relatorio_despesas_faturaveis_mediado(uuid,uuid,date,date)','execute'), 'anon não executa mediador');
select ok(has_function_privilege('authenticated','financeiro.sso_relatorio_despesas_faturaveis_mediado(uuid,uuid,date,date)','execute'), 'authenticated alcança mediador');
select ok(not has_function_privilege('authenticated','financeiro.sso_relatorio_despesas_faturaveis(uuid,date,date)','execute'), 'núcleo permanece privado');
select ok(not has_table_privilege('authenticated','financeiro.sso_relatorio_despesas_mediado_gate','select'), 'gate não é lido diretamente');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='financeiro.sso_relatorio_despesas_mediado_gate'::regclass), 'gate tem RLS forçada');
set local role authenticated;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select financeiro.sso_relatorio_despesas_faturaveis_mediado('18200000-0000-4000-8000-000000000001','18200000-0000-4000-8000-000000000002','2026-01-01','2026-12-31')$$,'55000','relatorio_bloqueado','gate fechado impede leitura');
reset role;
select * from finish();
rollback;
