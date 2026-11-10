-- E01-S184 AC-5/AC-6: fixtures apenas no banco local, sem arquivos ou URLs reais.
begin;
select plan(17);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18410000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'financeiro-s184@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18410000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cliente-anexo-s184@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18410000-0000-0000-0000-000000000001', 'colaborador', 'Financeiro S184', true),
 ('18410000-0000-0000-0000-000000000002', 'cliente-sindico', 'Cliente S184', true);
insert into config.usuario_modulos (user_id, modulo, nivel) values
 ('18410000-0000-0000-0000-000000000001', 'financeiro', 'escrita');
insert into financeiro.categorias (id, nome, tipo) values ('18410000-0000-0000-0000-000000000011', 'Categoria teste S184', 'entrada');
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, comprovante_path)
values ('18410000-0000-0000-0000-000000000012', 'entrada', 'previsto', 100, '2026-10-01', '2026-10-01', '18410000-0000-0000-0000-000000000011', 's184/nota-privada.pdf');
insert into storage.objects (bucket_id, name) values ('financeiro-comprovantes', 's184/nota-privada.pdf');
insert into storage.objects (bucket_id, name) values ('portal-chamados-anexos', '18410000-0000-0000-0000-000000000003/foto.jpg');
select is((select public from storage.buckets where id = 'financeiro-comprovantes'), false, 'bucket de comprovantes é privado');
set local role authenticated;
set local request.jwt.claims = '{"sub":"18410000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select has_function('financeiro', 'sso_comprovante_autorizado', array['uuid'], 'consulta segura de comprovante existe');
select lives_ok($$ select financeiro.sso_comprovante_autorizado('18410000-0000-0000-0000-000000000012') $$, 'financeiro autorizado consulta referência do comprovante');
select is(financeiro.sso_comprovante_autorizado('18410000-0000-0000-0000-000000000012'), 's184/nota-privada.pdf', 'referência vem do lançamento vinculado');
select throws_ok($$ select financeiro.sso_comprovante_autorizado('18410000-0000-0000-0000-000000000099') $$, '42501', 'comprovante_nao_encontrado_ou_sem_acesso', 'lançamento ausente não revela detalhes');
select is((select count(*)::int from storage.objects where bucket_id = 'financeiro-comprovantes' and name = 's184/nota-privada.pdf'), 0, 'financeiro autorizado não lê diretamente o Storage');
set local request.jwt.claims = '{"sub":"18410000-0000-0000-0000-000000000002","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18410000-0000-0000-0000-000000000003"}';
select throws_ok($$ select financeiro.sso_comprovante_autorizado('18410000-0000-0000-0000-000000000012') $$, '42501', 'comprovante_nao_encontrado_ou_sem_acesso', 'Cliente não resolve caminho privado');
select is((select count(*)::int from storage.objects where bucket_id = 'financeiro-comprovantes' and name = 's184/nota-privada.pdf'), 0, 'cliente não acessa comprovante');
select is((select count(*)::int from storage.objects where bucket_id = 'portal-chamados-anexos' and name like '%/foto.jpg'), 1, 'política de comprovantes não bloqueia anexos de chamado');
set local request.jwt.claims = '{"sub":"18410000-0000-0000-0000-000000000002","role":"authenticated","user_role":"superadmin","user_modulos":{"financeiro":"escrita"}}';
select is((select count(*)::int from storage.objects where bucket_id = 'financeiro-comprovantes' and name = 's184/nota-privada.pdf'), 0, 'cliente com token administrativo antigo não acessa comprovante');
reset role;
update config.usuario_modulos set nivel = 'leitura' where user_id = '18410000-0000-0000-0000-000000000001' and modulo = 'financeiro';
set local role authenticated;
set local request.jwt.claims = '{"sub":"18410000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select is(financeiro.sso_comprovante_autorizado('18410000-0000-0000-0000-000000000012'), 's184/nota-privada.pdf', 'leitura financeira atual conserva acesso à referência');
select is((select count(*)::int from storage.objects where bucket_id = 'financeiro-comprovantes' and name = 's184/nota-privada.pdf'), 0, 'leitura financeira ocorre pela rota, não Storage direto');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('financeiro-comprovantes', 's184/outro.pdf') $$, '42501', null, 'redução para leitura bloqueia upload com token antigo');
select is(config.s184_financeiro_escrita_atual(), false, 'redução para leitura não concede escrita atual');
reset role;
delete from config.usuario_modulos where user_id = '18410000-0000-0000-0000-000000000001' and modulo = 'financeiro';
set local role authenticated;
set local request.jwt.claims = '{"sub":"18410000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"financeiro":"escrita"}}';
select throws_ok($$ select financeiro.sso_comprovante_autorizado('18410000-0000-0000-0000-000000000012') $$, '42501', 'comprovante_nao_encontrado_ou_sem_acesso', 'revogação atual bloqueia referência com token antigo');
select is((select count(*)::int from storage.objects where bucket_id = 'financeiro-comprovantes' and name = 's184/nota-privada.pdf'), 0, 'permissão revogada invalida nova leitura com token antigo');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('financeiro-comprovantes', 's184/outro.pdf') $$, '42501', null, 'permissão revogada invalida upload');
select * from finish();
rollback;
