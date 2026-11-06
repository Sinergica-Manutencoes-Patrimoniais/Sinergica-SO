begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(7);
select ok(not (select habilitado from pcm.sso_recuperar_upload_comprovante_gate where id), 'gate de recuperação inicia fechado');
select ok(not has_function_privilege('anon', 'pcm.sso_recuperar_upload_comprovante_servico(uuid,uuid,uuid,text)', 'execute'), 'anon não executa recuperação');
select ok(not has_function_privilege('authenticated', 'pcm.sso_recuperar_upload_comprovante_servico(uuid,uuid,uuid,text)', 'execute'), 'authenticated não executa recuperação');
select ok(has_function_privilege('service_role', 'pcm.sso_recuperar_upload_comprovante_servico(uuid,uuid,uuid,text)', 'execute'), 'somente serviço recebe execução explícita');
select ok(not has_table_privilege('authenticated', 'pcm.sso_recuperar_upload_comprovante_gate', 'select'), 'usuário não lê gate diretamente');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'pcm.sso_recuperar_upload_comprovante_gate'::regclass), 'gate tem RLS forçada');
set local request.jwt.claims = '{"role":"service_role"}';
set local role service_role;
select throws_ok(
  $$select pcm.sso_recuperar_upload_comprovante_servico('18090000-0000-4000-8000-000000000001'::uuid, '18090000-0000-4000-8000-000000000002'::uuid, '18090000-0000-4000-8000-000000000003'::uuid, repeat('a', 64))$$,
  '55000', 'recuperacao_desabilitada', 'serviço não recupera enquanto gate está fechado'
);
reset role;
select * from finish();
rollback;
