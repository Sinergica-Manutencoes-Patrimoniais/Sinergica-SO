-- E01-S167 US2/AC-5: caracterização do estado atual, não prova de regra de negócio.
-- `pcm.sso_encerrar_chamado_conferido` (0611/1027) e `pcm.sso_diagnosticar_aptidao_chamado` (0621)
-- nunca receberam `grant execute ... to authenticated` em nenhuma migration (conferido por busca
-- em todo supabase/migrations/) — diferente de US1, onde o gate fechado é a única trava
-- (`pcm.sso_criar_os_chamado_autorizado` tem grant e já é testável hoje). Aqui a trava é dupla:
-- mesmo abrindo os dois gates (`chamado_os_gate`, `sso_encerramento_chamado_gate`) dentro da
-- própria transação de teste, a chamada falha por falta de privilégio, antes de qualquer regra de
-- negócio ser avaliada. Isto não é AC-5 provado — é o estado real registrado, pra não presumir
-- "só falta ligar o gate" como aconteceu com US1.
begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16752000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's167-aptidao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('16752000-0000-4000-8000-000000000001', 'superadmin', 'S167 Aptidão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values ('16752000-0000-4000-8000-000000000002', 'Cliente S167 Aptidão', true, '16752000-0000-4000-8000-000000000001');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values ('16752000-0000-4000-8000-000000000011', 'CH-S167-APT', '16752000-0000-4000-8000-000000000002', 'Chamado aptidão', '16752000-0000-4000-8000-000000000001');

-- Gates abertos LOCALMENTE, só nesta transação de teste (rollback no fim) — nunca em migration.
update pcm.chamado_os_gate set habilitado = true where id;
update pcm.sso_encerramento_chamado_gate set habilitado = true where id;

set local role authenticated;
set local request.jwt.claims = '{"sub":"16752000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select is((select habilitado from pcm.chamado_os_gate where id), true, 'gate de múltiplas OS aberto só nesta transação de teste');
select is((select habilitado from pcm.sso_encerramento_chamado_gate where id), true, 'gate de encerramento aberto só nesta transação de teste');
select throws_ok($$ select pcm.sso_diagnosticar_aptidao_chamado('16752000-0000-4000-8000-000000000002', '16752000-0000-4000-8000-000000000011') $$, '42501', null, 'diagnóstico de aptidão: sem grant a authenticated, mesmo com os dois gates abertos');
select throws_ok($$ select pcm.sso_encerrar_chamado_conferido(gen_random_uuid(), '16752000-0000-4000-8000-000000000002', '16752000-0000-4000-8000-000000000011', 1, 'teste') $$, '42501', null, 'encerramento conferido: sem grant a authenticated, mesmo com os dois gates abertos');

select * from finish();
rollback;
