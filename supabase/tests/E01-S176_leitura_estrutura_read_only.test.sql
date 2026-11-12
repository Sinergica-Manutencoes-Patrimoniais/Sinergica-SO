-- E01-S176 (migration 1841) — trava a regressão do bug encontrado em produção em 2026-11-12:
-- "Dashboard indisponível" no PCM, causado por toda leitura de pcm.equipamentos/sistemas/
-- sistema_itens via GET (PostgREST) quebrar com 25006 "cannot execute SELECT FOR SHARE in a
-- read-only transaction".
--
-- A causa era a policy RLS restritiva de 1809 chamar uma função de gate que fazia `for share` —
-- e RLS USING roda dentro da própria consulta que o PostgREST expõe via GET, sempre read-only.
-- Reproduz aqui a MESMA condição: `set transaction read only` antes da leitura, exatamente como
-- o PostgREST faz em todo GET. Sem a correção da 1841, este teste falharia com 25006 mesmo com o
-- gate fechado (estado padrão em produção) — o bug nunca dependeu do gate estar aberto.
begin;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17600000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's176-leitura-ro@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('17600000-0000-4000-8000-000000000001', 'superadmin', 'S176 Leitura RO', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17600000-0000-4000-8000-00000000000a', 'Cliente S176 Leitura RO', true, '17600000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('17600000-0000-4000-8000-000000000001', 'cadastro.ler', '17600000-0000-4000-8000-00000000000a');
insert into pcm.sistemas (id, cliente_id, nome, created_by) values
 ('17600000-0000-4000-8000-00000000002a', '17600000-0000-4000-8000-00000000000a', 'Sistema de teste', '17600000-0000-4000-8000-000000000001');
insert into pcm.equipamentos (id, nome, client_id, created_by) values
 ('17600000-0000-4000-8000-00000000003a', 'Equipamento de teste', '17600000-0000-4000-8000-00000000000a', '17600000-0000-4000-8000-000000000001');

-- Confirma que o gate segue no estado padrão (fechado) — o bug nunca exigiu abri-lo.
select is(
  (select habilitado from config.sso_estrutura_cliente_leitura_gate where id), false,
  'gate de isolamento de leitura de estrutura segue fechado por padrão'
);

set local transaction read only;
set local request.jwt.claims = '{"sub":"17600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- A mesma transação read-only que o PostgREST usa em todo GET — antes da 1841, qualquer uma
-- destas três quebrava com 25006, não importa o conteúdo lido.
select lives_ok(
  $$ select count(*) from pcm.equipamentos $$,
  'leitura de pcm.equipamentos sob transação read-only não quebra mais (25006)'
);
select lives_ok(
  $$ select count(*) from pcm.sistemas $$,
  'leitura de pcm.sistemas sob transação read-only não quebra mais (25006)'
);
select lives_ok(
  $$ select count(*) from pcm.sistema_itens $$,
  'leitura de pcm.sistema_itens sob transação read-only não quebra mais (25006)'
);

select * from finish();
rollback;
