-- Apenas banco local descartável; executar como supabase_admin. Operações disputadas são revertidas.
begin;
create extension if not exists dblink with schema extensions;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(30);
select extensions.dblink_connect_u('s165a', 'dbname=postgres user=postgres');
select extensions.dblink_connect_u('s165b', 'dbname=postgres user=postgres');
select extensions.dblink_exec('s165a', $$
 set app.auvo_sync_write = 'true';
 insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
 values ('16540000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aprovacao-concorrencia@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
 insert into config.usuarios(user_id, papel, nome, ativo) values ('16540000-0000-0000-0000-000000000001', 'superadmin', 'Aprovação concorrente', true);
 insert into pcm.clientes(id, nome, ativo, created_by) values ('16540000-0000-0000-0000-00000000000a', 'Cliente concorrente', true, '16540000-0000-0000-0000-000000000001');
 insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('16540000-0000-0000-0000-000000000001', 'plano.gerir', '16540000-0000-0000-0000-00000000000a');
 insert into pcm.sistemas(id, cliente_id, nome) values ('16540000-0000-0000-0000-000000000051', '16540000-0000-0000-0000-00000000000a', 'Sistema original');
 insert into pcm.questionarios(id, auvo_id, nome, perguntas, ativo) values ('16540000-0000-0000-0000-000000000061', 165400061, 'Questionário original', '[]', true);
 insert into pcm.planos_manutencao(id, cliente_id, nome, estado, revisao, created_by) values ('16540000-0000-0000-0000-000000000011', '16540000-0000-0000-0000-00000000000a', 'Plano concorrente', 'em_revisao', 3, '16540000-0000-0000-0000-000000000001');
 insert into pcm.plano_versoes(id, plano_id, numero, created_by) values ('16540000-0000-0000-0000-000000000091', '16540000-0000-0000-0000-000000000011', 1, '16540000-0000-0000-0000-000000000001');
 insert into pcm.rotinas_manutencao(id, rotina_logica_id, plano_id, versao_id, nome, alvo_tipo, sistema_id, modo, intervalo_n, intervalo_unidade, data_base, tempo_minutos, tipo_tempo, instrucao, questionario_id, created_by)
 values ('16540000-0000-0000-0000-000000000081', '16540000-0000-0000-0000-000000000081', '16540000-0000-0000-0000-000000000011', '16540000-0000-0000-0000-000000000091', 'Inspeção', 'sistema', '16540000-0000-0000-0000-000000000051', 'calendario', 1, 'meses', '2026-11-01', 30, 'total', 'Inspecionar', '16540000-0000-0000-0000-000000000061', '16540000-0000-0000-0000-000000000001');
$$);
select extensions.dblink_exec('s165b', $$ set app.auvo_sync_write = 'true' $$);
select extensions.dblink_exec('s165b', $$ set request.jwt.claims = '{"sub":"16540000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}' $$);
select extensions.dblink_exec('s165b', 'set role authenticated');
-- Alteração de fonte começa primeiro; aprovação precisa aguardar e ler após rollback.
select extensions.dblink_exec('s165a', 'begin');
select extensions.dblink_exec('s165b', 'begin');
select extensions.dblink_exec('s165a', $$ update pcm.sistemas set nome = 'Não confirmado' where id = '16540000-0000-0000-0000-000000000051' $$);
select is(extensions.dblink_send_query('s165b', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000101', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$), 1, 'inicia aprovação concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s165b'), 1, 'aprovação espera alteração da fonte');
select extensions.dblink_exec('s165a', 'rollback');
select is(resultado->>'state', 'aprovado', 'aprovação prossegue após rollback da fonte') from extensions.dblink_get_result('s165b') as t(resultado jsonb);
select * from extensions.dblink_get_result('s165b') as t(resultado jsonb);
select is(nome, 'Sistema original', 'snapshot não usa alteração revertida') from extensions.dblink('s165b', $$ select snapshot->'rotinas'->0->'alvo'->>'nome' from pcm.plano_versoes where id = '16540000-0000-0000-0000-000000000091' $$) as t(nome text);
select extensions.dblink_exec('s165b', 'rollback');
-- Aprovação começa primeiro; alteração de fonte aguarda até final da transação.
select extensions.dblink_exec('s165a', 'begin');
select extensions.dblink_exec('s165b', 'begin');
select is(resultado->>'state', 'aprovado', 'segunda aprovação obtém bloqueio da fonte') from extensions.dblink('s165b', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000102', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s165a', $$ update pcm.sistemas set nome = 'Mudança posterior' where id = '16540000-0000-0000-0000-000000000051' returning nome $$), 1, 'inicia atualização concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s165a'), 1, 'atualização espera fim da aprovação');
select extensions.dblink_exec('s165b', 'rollback');
select is(nome, 'Mudança posterior', 'atualização prossegue depois do rollback') from extensions.dblink_get_result('s165a') as t(nome text);
select * from extensions.dblink_get_result('s165a') as t(nome text);
select extensions.dblink_exec('s165a', 'rollback');
select is((select estado from pcm.planos_manutencao where id = '16540000-0000-0000-0000-000000000011'), 'em_revisao', 'rollbacks preservam estado inicial');
select is((select count(*)::int from audit.events where entity_id = '16540000-0000-0000-0000-000000000011'), 0, 'nenhuma auditoria sintética persistiu');
-- Mesmo pedido em duas sessões não pode executar simultaneamente.
select extensions.dblink_exec('s165a', 'begin');
select extensions.dblink_exec('s165a', $$ set local request.jwt.claims = '{"sub":"16540000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}' $$);
select extensions.dblink_exec('s165a', 'set local role authenticated');
select extensions.dblink_exec('s165b', 'begin');
select is((resultado->>'revision')::int, 4, 'primeira aprovação obtém revisão') from extensions.dblink('s165b', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000104', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$) as t(resultado jsonb);
select is(extensions.dblink_send_query('s165a', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000104', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$), 1, 'inicia retry concorrente');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s165a'), 1, 'retry espera conclusão do primeiro pedido');
select extensions.dblink_exec('s165b', 'rollback');
select is((resultado->>'revision')::int, 4, 'retry executa após rollback do primeiro') from extensions.dblink_get_result('s165a') as t(resultado jsonb);
select * from extensions.dblink_get_result('s165a') as t(resultado jsonb);
select extensions.dblink_exec('s165a', 'rollback');
-- Mudança confirmada no questionário deve aparecer no snapshot efetivamente aprovado.
select extensions.dblink_exec('s165a', 'begin');
select extensions.dblink_exec('s165b', 'begin');
select extensions.dblink_exec('s165a', $$ update pcm.questionarios set nome = 'Questionário revisado', perguntas = '[{"texto":"Nova"}]' where id = '16540000-0000-0000-0000-000000000061' $$);
select is(extensions.dblink_send_query('s165b', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000105', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$), 1, 'inicia aprovação contra edição de questionário');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s165b'), 1, 'aprovação espera questionário em edição');
select extensions.dblink_exec('s165a', 'commit');
select is(resultado->>'state', 'aprovado', 'aprovação prossegue após alteração confirmada') from extensions.dblink_get_result('s165b') as t(resultado jsonb);
select * from extensions.dblink_get_result('s165b') as t(resultado jsonb);
select is(nome, 'Questionário revisado', 'snapshot contém a versão efetivamente confirmada do questionário') from extensions.dblink('s165b', $$ select snapshot->'rotinas'->0->'questionario'->>'nome' from pcm.plano_versoes where id = '16540000-0000-0000-0000-000000000091' $$) as t(nome text);
select extensions.dblink_exec('s165b', 'rollback');
-- Revogação enquanto aprovação aguarda referência não pode ser ignorada.
select extensions.dblink_exec('s165a', 'begin');
select extensions.dblink_exec('s165b', 'begin');
select extensions.dblink_exec('s165a', $$ update pcm.sistemas set nome = nome where id = '16540000-0000-0000-0000-000000000051' $$);
select extensions.dblink_exec('s165a', $$ update config.sso_concessoes set ativa = false where usuario_id = '16540000-0000-0000-0000-000000000001' and acao = 'plano.gerir' $$);
select is(extensions.dblink_send_query('s165b', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000106', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$), 1, 'inicia aprovação antes de revogação confirmada');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s165b'), 1, 'aprovação aguarda referência durante revogação');
select extensions.dblink_exec('s165a', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s165b', false) as t(resultado jsonb)), 0, 'revogação confirmada impede sucesso');
select ok(position('sem_acesso' in extensions.dblink_error_message('s165b')) > 0, 'aprovação reavalia permissão revogada');
select * from extensions.dblink_get_result('s165b', false) as t(resultado jsonb);
select extensions.dblink_exec('s165b', 'rollback');
select extensions.dblink_exec('s165a', $$ update config.sso_concessoes set ativa = true where usuario_id = '16540000-0000-0000-0000-000000000001' and acao = 'plano.gerir' $$);
-- Uma revisão confirmada por outra sessão invalida a aprovação com revisão antiga.
select extensions.dblink_exec('s165a', 'begin');
select extensions.dblink_exec('s165b', 'begin');
select extensions.dblink_exec('s165a', $$ update pcm.planos_manutencao set revisao = 4, estado = 'rascunho' where id = '16540000-0000-0000-0000-000000000011' $$);
select is(extensions.dblink_send_query('s165b', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000107', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$), 1, 'inicia aprovação com alteração concorrente do Plano');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s165b'), 1, 'aprovação aguarda alteração do Plano');
select extensions.dblink_exec('s165a', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s165b', false) as t(resultado jsonb)), 0, 'revisão antiga não aprova');
select ok(position('revisao_obsoleta' in extensions.dblink_error_message('s165b')) > 0, 'conflito aponta revisão obsoleta');
select * from extensions.dblink_get_result('s165b', false) as t(resultado jsonb);
select extensions.dblink_exec('s165b', 'rollback');
select extensions.dblink_exec('s165a', $$ update pcm.planos_manutencao set revisao = 3, estado = 'em_revisao' where id = '16540000-0000-0000-0000-000000000011' $$);
-- Desativação confirmada antes da aprovação deve ser revalidada, não lida de snapshot antigo.
select extensions.dblink_exec('s165a', 'begin');
select extensions.dblink_exec('s165b', 'begin');
select extensions.dblink_exec('s165a', $$ update pcm.sistemas set ativo = false where id = '16540000-0000-0000-0000-000000000051' $$);
select is(extensions.dblink_send_query('s165b', $$ select pcm.sso_aprovar_plano('16540000-0000-0000-0000-000000000103', 3, '16540000-0000-0000-0000-000000000011', '2026-11-01') $$), 1, 'inicia aprovação contra desativação');
select pg_sleep(0.2);
select is(extensions.dblink_is_busy('s165b'), 1, 'aprovação espera desativação não confirmada');
select extensions.dblink_exec('s165a', 'commit');
select is((select count(*)::int from extensions.dblink_get_result('s165b', false) as t(resultado jsonb)), 0, 'aprovação não retorna sucesso após desativação confirmada');
select ok(position('plano_incompleto' in extensions.dblink_error_message('s165b')) > 0, 'aprovação identifica alvo indisponível');
select * from extensions.dblink_get_result('s165b', false) as t(resultado jsonb);
select extensions.dblink_exec('s165b', 'rollback');
select extensions.dblink_exec('s165a', $$
 delete from pcm.rotinas_manutencao where plano_id = '16540000-0000-0000-0000-000000000011';
 delete from pcm.plano_versoes where plano_id = '16540000-0000-0000-0000-000000000011';
 delete from pcm.planos_manutencao where id = '16540000-0000-0000-0000-000000000011';
 delete from pcm.questionarios where id = '16540000-0000-0000-0000-000000000061';
 delete from pcm.sistemas where id = '16540000-0000-0000-0000-000000000051';
 delete from config.sso_concessoes where usuario_id = '16540000-0000-0000-0000-000000000001';
 delete from pcm.clientes where id = '16540000-0000-0000-0000-00000000000a';
 delete from config.usuarios where user_id = '16540000-0000-0000-0000-000000000001';
 delete from auth.users where id = '16540000-0000-0000-0000-000000000001';
$$);
select extensions.dblink_disconnect('s165a');
select extensions.dblink_disconnect('s165b');
select * from finish();
rollback;
