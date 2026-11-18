-- E01-S189 (SSO-017) — alcance de financeiro.sso_publicar_cobranca_os, que escreve SEM gate.
begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18890000-0000-4000-8000-000000000021', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-cobranca@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18890000-0000-4000-8000-000000000022', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's189-cobranca-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18890000-0000-4000-8000-000000000021', 'superadmin', 'S189 Cobrança', true),
 ('18890000-0000-4000-8000-000000000022', 'colaborador', 'S189 Cobrança Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18890000-0000-4000-8000-00000000021a', 'Cliente S189 Cobrança', true, '18890000-0000-4000-8000-000000000021');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18890000-0000-4000-8000-000000000021', 'faturavel.efetivar', '18890000-0000-4000-8000-00000000021a');
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, created_by) values
 ('18890000-0000-4000-8000-00000000022a', '18890000-0000-4000-8000-00000000021a', 'OS-S189-COBR', 'OS da cobrança', 'corretiva', '18890000-0000-4000-8000-000000000021');
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id, os_id, created_by)
  select '18890000-0000-4000-8000-00000000023a', 'entrada', 'previsto', 50000, '2026-11-01', '2026-11-15', c.id,
    '18890000-0000-4000-8000-00000000021a', '18890000-0000-4000-8000-00000000022a', '18890000-0000-4000-8000-000000000021'
  from financeiro.categorias c limit 1;

-- ── AC-1: gate fechado por padrão ─────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000021","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_publicar_cobranca_os_mediada(%L,%L,%L,'Serviço prestado em novembro',50000,'2026-11-01','2026-11-15') $f$,
    '18890000-0000-4000-8000-0000000000e5', '18890000-0000-4000-8000-00000000023a', '18890000-0000-4000-8000-00000000022a'),
  '55000', 'cobranca_os_indisponivel', 'gate de cobrança fechado por padrão recusa com erro nomeado'
);

-- ── AC-3: gate aberto, mas sem concessão continua recusado ────────────────────────────────
reset role;
update financeiro.sso_cobranca_os_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000022","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_publicar_cobranca_os_mediada(%L,%L,%L,'Serviço prestado em novembro',50000,'2026-11-01','2026-11-15') $f$,
    '18890000-0000-4000-8000-0000000000e6', '18890000-0000-4000-8000-00000000023a', '18890000-0000-4000-8000-00000000022a'),
  '42501', 'lancamento_nao_encontrado_ou_sem_acesso', 'gate aberto não basta sem a concessão faturavel.efetivar'
);

-- ── AC-2: gate aberto + concessão correta publica, e é idempotente ───────────────────────
reset role;
set local request.jwt.claims = '{"sub":"18890000-0000-4000-8000-000000000021","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select (financeiro.sso_publicar_cobranca_os_mediada('18890000-0000-4000-8000-0000000000e5', '18890000-0000-4000-8000-00000000023a',
  '18890000-0000-4000-8000-00000000022a', 'Serviço prestado em novembro', 50000, '2026-11-01', '2026-11-15')) as publicacao \gset
select isnt(:'publicacao'::jsonb->>'publicacaoId', null::text, 'com o gate aberto, a cobrança é publicada de verdade');
select is(
  (financeiro.sso_publicar_cobranca_os_mediada('18890000-0000-4000-8000-0000000000e5', '18890000-0000-4000-8000-00000000023a',
    '18890000-0000-4000-8000-00000000022a', 'Serviço prestado em novembro', 50000, '2026-11-01', '2026-11-15'))->>'publicacaoId',
  :'publicacao'::jsonb->>'publicacaoId', 'replay do mesmo requestId devolve a mesma publicação'
);

reset role;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'financeiro' and p.proname = 'sso_publicar_cobranca_os'
       and has_function_privilege('authenticated', p.oid, 'execute')),
  0, 'o núcleo continua revogado de authenticated'
);

select * from finish();
rollback;
