-- Somente banco local de teste. Fixtures sintéticas exclusivas são removidas ao final.
begin;
create extension if not exists dblink with schema extensions;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(47);
select extensions.dblink_connect_u('s171a', 'dbname=postgres user=postgres');
select extensions.dblink_connect_u('s171b', 'dbname=postgres user=postgres');
select extensions.dblink_exec('s171a', $$
 set app.auvo_sync_write = 'true';
 insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
 values ('17190000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's171-concorrencia@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
 insert into config.usuarios(user_id, papel, nome, ativo) values ('17190000-0000-0000-0000-000000000001', 'superadmin', 'Teste S171', true);
 insert into pcm.clientes(id, nome, ativo, created_by) values ('17190000-0000-0000-0000-00000000000a', 'Cliente teste S171', true, '17190000-0000-0000-0000-000000000001');
 insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('17190000-0000-0000-0000-000000000001', 'visita.confirmar', '17190000-0000-0000-0000-00000000000a');
 insert into pcm.funcionarios(id, nome, ativo) values ('17190000-0000-0000-0000-000000000041', 'Técnico teste S171', true);
 insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, created_by) values ('17190000-0000-0000-0000-000000000051', '17190000-0000-0000-0000-00000000000a', 'OS-S171-CONCORRENCIA', 'OS teste', 'preventiva', '17190000-0000-0000-0000-000000000001');
 insert into pcm.visitas(id, cliente_id, inicio_em, fim_em, fuso, natureza, estado, responsavel_id, created_by) values ('17190000-0000-0000-0000-000000000061', '17190000-0000-0000-0000-00000000000a', '2026-11-01 11:00+00', '2026-11-01 13:00+00', 'America/Sao_Paulo', 'regular', 'planejada', '17190000-0000-0000-0000-000000000041', '17190000-0000-0000-0000-000000000001');
 insert into pcm.visita_ordens_servico(id, visita_id, os_id, cliente_id, sequencia, created_by) values ('17190000-0000-0000-0000-000000000071', '17190000-0000-0000-0000-000000000061', '17190000-0000-0000-0000-000000000051', '17190000-0000-0000-0000-00000000000a', 1, '17190000-0000-0000-0000-000000000001');
 insert into pcm.visita_equipes(id, visita_id, cliente_id, funcionario_id, papel, created_by) values ('17190000-0000-0000-0000-000000000081', '17190000-0000-0000-0000-000000000061', '17190000-0000-0000-0000-00000000000a', '17190000-0000-0000-0000-000000000041', 'Técnico', '17190000-0000-0000-0000-000000000001');
$$);
select extensions.dblink_exec('s171a', $$ set request.jwt.claims = '{"sub":"17190000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}' $$);
select extensions.dblink_exec('s171b', $$ set request.jwt.claims = '{"sub":"17190000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}' $$);
select extensions.dblink_exec('s171a', 'set role authenticated');
select extensions.dblink_exec('s171b', 'set role authenticated');
-- Revogação após a checagem inicial, enquanto confirmação espera funcionário.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
\if :{?sso_migration}
select extensions.dblink_exec('s171b', 'reset role');
select extensions.dblink_exec('s171b', :'sso_migration');
select extensions.dblink_exec('s171b', 'set role authenticated');
\endif
select extensions.dblink_exec('s171a', 'reset role');
select extensions.dblink_exec('s171a', $$ update pcm.funcionarios set nome = nome where id = '17190000-0000-0000-0000-000000000041' $$);
select is(extensions.dblink_send_query('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000110', 1, '17190000-0000-0000-0000-000000000061') $$), 1, 'inicia confirmação antes da revogação durante espera de funcionário');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171b'), 1, 'confirmação espera funcionário');
select extensions.dblink_exec('s171a', $$ update config.sso_concessoes set ativa = false where usuario_id = '17190000-0000-0000-0000-000000000001' and cliente_id = '17190000-0000-0000-0000-00000000000a' and acao = 'visita.confirmar' $$);
select extensions.dblink_exec('s171a', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s171b', false) as t(resultado jsonb)), 0, 'revogação confirmada durante espera impede confirmação');
select ok(position('sem_acesso' in extensions.dblink_error_message('s171b')) > 0, 'confirmação revalida autorização após espera do funcionário');
select * from extensions.dblink_get_result('s171b', false) as t(resultado jsonb);
select extensions.dblink_exec('s171b', 'rollback');
select extensions.dblink_exec('s171a', $$ update config.sso_concessoes set ativa = true where usuario_id = '17190000-0000-0000-0000-000000000001' and cliente_id = '17190000-0000-0000-0000-00000000000a' and acao = 'visita.confirmar' $$);
select extensions.dblink_exec('s171a', 'set role authenticated');
-- Ordem inversa: confirmação termina, mas ainda não confirma transação.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
\if :{?sso_migration}
select extensions.dblink_exec('s171b', 'reset role');
select extensions.dblink_exec('s171b', :'sso_migration');
select extensions.dblink_exec('s171b', 'set role authenticated');
\endif
select is(resultado->>'state', 'confirmada', 'confirmação inicia antes da revogação') from extensions.dblink('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000112', 1, '17190000-0000-0000-0000-000000000061') $$) as t(resultado jsonb);
select extensions.dblink_exec('s171a', 'reset role');
select is(extensions.dblink_send_query('s171a', $$ update config.sso_concessoes set ativa = false where usuario_id = '17190000-0000-0000-0000-000000000001' and cliente_id = '17190000-0000-0000-0000-00000000000a' and acao = 'visita.confirmar' returning ativa $$), 1, 'inicia revogação enquanto confirmação não foi confirmada');
select pg_sleep(0.2);
select todo_start('sem serialização comum, revogação pode concluir antes do commit da confirmação');
select is(extensions.dblink_is_busy('s171a'), 1, 'revogação aguarda transação de confirmação');
select todo_end();
select extensions.dblink_exec('s171b', 'rollback');
select is(ativa, false, 'revogação conclui após teste da confirmação') from extensions.dblink_get_result('s171a') as t(ativa boolean);
select * from extensions.dblink_get_result('s171a') as t(ativa boolean);
select extensions.dblink_exec('s171a', 'rollback');
select extensions.dblink_exec('s171a', 'set role authenticated');
-- A espera da OS ocorre dentro do trigger de atualização; também precisa revalidar.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
\if :{?sso_migration}
select extensions.dblink_exec('s171b', 'reset role');
select extensions.dblink_exec('s171b', :'sso_migration');
select extensions.dblink_exec('s171b', 'set role authenticated');
\endif
select extensions.dblink_exec('s171a', 'reset role');
select extensions.dblink_exec('s171a', $$ update pcm.ordens_servico set titulo = titulo where id = '17190000-0000-0000-0000-000000000051' $$);
select is(extensions.dblink_send_query('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000111', 1, '17190000-0000-0000-0000-000000000061') $$), 1, 'inicia confirmação antes da revogação durante espera da OS');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171b'), 1, 'confirmação espera OS');
select extensions.dblink_exec('s171a', $$ update config.sso_concessoes set ativa = false where usuario_id = '17190000-0000-0000-0000-000000000001' and cliente_id = '17190000-0000-0000-0000-00000000000a' and acao = 'visita.confirmar' $$);
select extensions.dblink_exec('s171a', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s171b', false) as t(resultado jsonb)), 0, 'revogação confirmada durante espera da OS impede confirmação');
select ok(position('sem_acesso' in extensions.dblink_error_message('s171b')) > 0, 'confirmação revalida autorização após espera da OS');
select * from extensions.dblink_get_result('s171b', false) as t(resultado jsonb);
select extensions.dblink_exec('s171b', 'rollback');
select extensions.dblink_exec('s171a', $$ update config.sso_concessoes set ativa = true where usuario_id = '17190000-0000-0000-0000-000000000001' and cliente_id = '17190000-0000-0000-0000-00000000000a' and acao = 'visita.confirmar' $$);
select extensions.dblink_exec('s171a', 'set role authenticated');
-- Configuração começa primeiro e é confirmada: snapshot deve ver a política nova.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
select is(resultado->>'state', 'configurada', 'política inicial fica em transação') from extensions.dblink('s171a', $$ select pcm.sso_configurar_ciencia_visita('17190000-0000-0000-0000-000000000101', 0, '17190000-0000-0000-0000-000000000091', '17190000-0000-0000-0000-00000000000a', null, null, 'obrigatoria') $$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000102', 1, '17190000-0000-0000-0000-000000000061') $$), 1, 'inicia confirmação concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171b'), 1, 'confirmação aguarda política não confirmada');
select extensions.dblink_exec('s171a', 'commit');
select is(resultado->>'state', 'confirmada', 'confirmação prossegue após commit') from extensions.dblink_get_result('s171b') as t(resultado jsonb);
select * from extensions.dblink_get_result('s171b') as t(resultado jsonb);
select is(modo, 'obrigatoria', 'snapshot usa política confirmada após espera') from extensions.dblink('s171b', $$ select politica_modo from pcm.visita_confirmacoes where visita_id = '17190000-0000-0000-0000-000000000061' $$) as t(modo text);
select extensions.dblink_exec('s171b', 'rollback');
-- Confirmação começa primeiro e é revertida: configuração precisa aguardar.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
select is(resultado->>'state', 'confirmada', 'confirmação retém bloqueio da política') from extensions.dblink('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000103', 1, '17190000-0000-0000-0000-000000000061') $$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s171a', $$ select pcm.sso_configurar_ciencia_visita('17190000-0000-0000-0000-000000000104', 1, '17190000-0000-0000-0000-000000000091', '17190000-0000-0000-0000-00000000000a', null, null, 'informativa') $$), 1, 'inicia alteração concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171a'), 1, 'alteração aguarda confirmação');
select extensions.dblink_exec('s171b', 'rollback');
select is(resultado->>'state', 'configurada', 'alteração prossegue após rollback') from extensions.dblink_get_result('s171a') as t(resultado jsonb);
select * from extensions.dblink_get_result('s171a') as t(resultado jsonb);
select extensions.dblink_exec('s171a', 'rollback');
select is((select estado from pcm.visitas where id = '17190000-0000-0000-0000-000000000061'), 'planejada', 'rollbacks preservam Visita');
select is((select modo from pcm.politicas_ciencia_visita where id = '17190000-0000-0000-0000-000000000091'), 'obrigatoria', 'rollback não altera política confirmada');
select is((select count(*)::int from pcm.visita_confirmacoes where visita_id = '17190000-0000-0000-0000-000000000061'), 0, 'confirmações revertidas não persistem');
-- A alteração de status da OS e a confirmação também precisam serializar.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
select extensions.dblink_exec('s171a', 'reset role');
select extensions.dblink_exec('s171a', $$ update pcm.ordens_servico set status = 'cancelado' where id = '17190000-0000-0000-0000-000000000051' $$);
select is(extensions.dblink_send_query('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000106', 1, '17190000-0000-0000-0000-000000000061') $$), 1, 'inicia confirmação enquanto alteração da OS está aberta');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171b'), 1, 'confirmação aguarda a alteração concorrente da OS');
select extensions.dblink_exec('s171a', 'rollback');
select is(resultado->>'state', 'confirmada', 'confirmação prossegue quando fechamento é revertido') from extensions.dblink_get_result('s171b') as t(resultado jsonb);
select * from extensions.dblink_get_result('s171b') as t(resultado jsonb);
select extensions.dblink_exec('s171b', 'rollback');
select extensions.dblink_exec('s171a', 'set role authenticated');
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
select is(resultado->>'state', 'confirmada', 'confirmação inicia antes de alteração da OS') from extensions.dblink('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000107', 1, '17190000-0000-0000-0000-000000000061') $$) as t(resultado jsonb);
select extensions.dblink_exec('s171a', 'reset role');
select is(extensions.dblink_send_query('s171a', $$ update pcm.ordens_servico set status = 'cancelado' where id = '17190000-0000-0000-0000-000000000051' returning status $$), 1, 'inicia fechamento concorrente da OS');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171a'), 1, 'fechamento aguarda confirmação');
select extensions.dblink_exec('s171b', 'rollback');
select is(status, 'cancelado', 'fechamento prossegue após rollback da confirmação') from extensions.dblink_get_result('s171a') as t(status text);
select * from extensions.dblink_get_result('s171a') as t(status text);
select extensions.dblink_exec('s171a', 'rollback');
select extensions.dblink_exec('s171a', 'set role authenticated');
select is((select estado from pcm.visitas where id = '17190000-0000-0000-0000-000000000061'), 'planejada', 'disputas revertidas preservam Visita');
-- Fechamento confirmado antes da liberação impede confirmação com OS encerrada.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
select extensions.dblink_exec('s171a', 'reset role');
select extensions.dblink_exec('s171a', $$ update pcm.ordens_servico set status = 'cancelado' where id = '17190000-0000-0000-0000-000000000051' $$);
select is(extensions.dblink_send_query('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000108', 1, '17190000-0000-0000-0000-000000000061') $$), 1, 'inicia confirmação antes de fechamento definitivo');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171b'), 1, 'confirmação aguarda fechamento ainda não confirmado');
select extensions.dblink_exec('s171a', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s171b', false) as t(resultado jsonb)), 0, 'fechamento confirmado impede confirmação');
select ok(position('os_nao_elegivel' in extensions.dblink_error_message('s171b')) > 0, 'erro identifica OS não elegível após espera');
select * from extensions.dblink_get_result('s171b', false) as t(resultado jsonb);
select extensions.dblink_exec('s171b', 'rollback');
select is((select estado from pcm.visitas where id = '17190000-0000-0000-0000-000000000061'), 'planejada', 'recusa preserva Visita planejada');
select extensions.dblink_exec('s171a', 'set role authenticated');
-- Mesmo pedido em duas sessões só deve produzir uma desvinculação.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
select is((resultado->>'revision')::int, 2, 'primeira desvinculação altera revisão') from extensions.dblink('s171a', $$ select pcm.sso_desvincular_os_visita('17190000-0000-0000-0000-000000000109', 1, '17190000-0000-0000-0000-000000000061', '17190000-0000-0000-0000-000000000071', 'Reprogramação') $$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s171b', $$ select pcm.sso_desvincular_os_visita('17190000-0000-0000-0000-000000000109', 1, '17190000-0000-0000-0000-000000000061', '17190000-0000-0000-0000-000000000071', 'Reprogramação') $$), 1, 'inicia retry simultâneo da desvinculação');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171b'), 1, 'retry aguarda operação original');
select extensions.dblink_exec('s171a', 'commit');
select is((resultado->>'revision')::int, 2, 'retry retorna mesma revisão após commit') from extensions.dblink_get_result('s171b') as t(resultado jsonb);
select * from extensions.dblink_get_result('s171b') as t(resultado jsonb);
select extensions.dblink_exec('s171b', 'commit');
select is((select count(*)::int from pcm.visita_comandos where request_id = '17190000-0000-0000-0000-000000000109'), 1, 'somente um comando persistido');
select is((select count(*)::int from audit.events where entity_id = '17190000-0000-0000-0000-000000000061' and action = 'visita.os_desvinculada'), 1, 'somente um evento de desvinculação');
-- Revogação confirmada enquanto confirmação aguarda precisa impedir sucesso.
select extensions.dblink_exec('s171a', 'begin');
select extensions.dblink_exec('s171b', 'begin');
select * from extensions.dblink('s171a', $$ select 1 from (select pg_advisory_xact_lock(hashtextextended('ciencia-scope:17190000-0000-0000-0000-00000000000a:-:-', 0))) x $$) as t(bloqueado integer);
select is(extensions.dblink_send_query('s171b', $$ select pcm.sso_confirmar_visita('17190000-0000-0000-0000-000000000105', 1, '17190000-0000-0000-0000-000000000061') $$), 1, 'inicia confirmação antes de revogação');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s171b'), 1, 'confirmação espera escopo durante revogação');
select extensions.dblink_exec('s171a', 'reset role');
select extensions.dblink_exec('s171a', $$ update config.sso_concessoes set ativa = false where usuario_id = '17190000-0000-0000-0000-000000000001' and cliente_id = '17190000-0000-0000-0000-00000000000a' and acao = 'visita.confirmar' $$);
select extensions.dblink_exec('s171a', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s171b', false) as t(resultado jsonb)), 0, 'revogação confirmada impede sucesso');
select ok(position('sem_acesso' in extensions.dblink_error_message('s171b')) > 0, 'confirmação reavalia autorização após espera');
select * from extensions.dblink_get_result('s171b', false) as t(resultado jsonb);
select extensions.dblink_exec('s171b', 'rollback');
-- Só IDs sintéticos acima: session_replication_role evita triggers imutáveis durante limpeza local.
select extensions.dblink_exec('s171a', $$
 reset role; set session_replication_role = replica;
 delete from audit.events where entity_id in ('17190000-0000-0000-0000-000000000091', '17190000-0000-0000-0000-000000000061');
 delete from pcm.visita_comandos where cliente_id = '17190000-0000-0000-0000-00000000000a';
 delete from pcm.politicas_ciencia_visita where id = '17190000-0000-0000-0000-000000000091';
 delete from pcm.visita_equipes where id = '17190000-0000-0000-0000-000000000081';
 delete from pcm.visita_ordens_servico where id = '17190000-0000-0000-0000-000000000071';
 delete from pcm.visitas where id = '17190000-0000-0000-0000-000000000061';
 delete from pcm.ordens_servico where id = '17190000-0000-0000-0000-000000000051';
 delete from pcm.funcionarios where id = '17190000-0000-0000-0000-000000000041';
 delete from config.sso_concessoes where usuario_id = '17190000-0000-0000-0000-000000000001' and cliente_id = '17190000-0000-0000-0000-00000000000a';
 delete from pcm.clientes where id = '17190000-0000-0000-0000-00000000000a';
 delete from config.usuarios where user_id = '17190000-0000-0000-0000-000000000001';
 delete from auth.users where id = '17190000-0000-0000-0000-000000000001';
 reset session_replication_role;
$$);
select extensions.dblink_disconnect('s171a');
select extensions.dblink_disconnect('s171b');
select * from finish();
rollback;
