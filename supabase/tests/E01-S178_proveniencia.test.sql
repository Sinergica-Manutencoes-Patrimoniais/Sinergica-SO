-- Executar apenas após as migrations; não usa dados reais.
begin;
select plan(6);
select ok(not has_function_privilege('authenticated', 'pcm.sso_receber_levantamento(uuid,uuid,text,text,jsonb)', 'execute'), 'RPC legada indisponível');
select has_function('pcm', 'sso_receber_levantamento_manual', array['uuid','uuid','text','text','jsonb'], 'entrada manual separada');
select ok(has_function_privilege('authenticated', 'pcm.sso_receber_levantamento_manual(uuid,uuid,text,text,jsonb)', 'execute'), 'usuário autenticado pode chamar entrada manual');
select has_column('pcm', 'sso_levantamentos', 'meio_recepcao', 'meio de recepção distinto da declaração');
select has_column('pcm', 'sso_levantamentos', 'origem_declarada', 'origem declarada separada');
select ok(not has_function_privilege('anon', 'pcm.sso_receber_levantamento_manual(uuid,uuid,text,text,jsonb)', 'execute'), 'anônimo não acessa entrada manual');
select * from finish();
rollback;
