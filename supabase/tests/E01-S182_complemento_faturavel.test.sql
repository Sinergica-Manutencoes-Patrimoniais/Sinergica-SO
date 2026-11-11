-- E01-S182 (complemento de item faturável, 0404/1559) — prova real: complemento sempre referencia
-- a origem base (nunca encadeia complemento sobre complemento), identidade item_base_id/
-- complemento_id anda sempre junto, unicidade (cliente,origem_tipo,origem_id) só vale pra base
-- (índice parcial sso_faturavel_origem_base), idempotência e concorrência otimista. Auditoria de
-- 2026-11-10 encontrou só 3 arquivos pgTAP pra 111 migrations — primeira prova desta fatia.
begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18200000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-complemento@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('18200000-0000-4000-8000-000000000001', 'superadmin', 'S182 Complemento', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18200000-0000-4000-8000-000000000002', 'Cliente S182 A', true, '18200000-0000-4000-8000-000000000001'),
 ('18200000-0000-4000-8000-000000000003', 'Cliente Divergente S182', true, '18200000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18200000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18200000-0000-4000-8000-000000000002');
insert into financeiro.itens_faturaveis (id, cliente_id, origem_tipo, origem_id, valor_original_centavos, valor_conferido_centavos, competencia, status, revisao) values
 ('18200000-0000-4000-8000-000000000004', '18200000-0000-4000-8000-000000000002', 'despesa_visita', '18200000-0000-4000-8000-000000000099', 100000, 100000, '2026-11-01', 'conferido', 1);

set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_complementar_faturavel_mediado(%L,%L,gen_random_uuid(),%L,1,gen_random_uuid(),gen_random_uuid(),5000,'serviço extra solicitado em campo') $f$,
    '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002', '18200000-0000-4000-8000-000000000004'),
  '55000', 'correcao_desabilitada', 'gate de escrita mediada fechado por padrão recusa o complemento'
);

reset role;
update financeiro.sso_correcao_faturavel_mediada_gate set escrita = true where id;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_complementar_faturavel_mediado(%L,%L,gen_random_uuid(),%L,1,gen_random_uuid(),gen_random_uuid(),5000,'serviço extra solicitado em campo') $f$,
    '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002', '18200000-0000-4000-8000-000000000004'),
  '55000', 'faturamento_indisponivel', 'gate principal de faturamento fechado recusa mesmo com a mediação aberta'
);

reset role;
update financeiro.sso_faturamento_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_complementar_faturavel_mediado(%L,%L,gen_random_uuid(),%L,1,gen_random_uuid(),gen_random_uuid(),5000,'teste') $f$,
    '18200000-0000-4000-8000-000000000003', '18200000-0000-4000-8000-000000000003', '18200000-0000-4000-8000-000000000004'),
  '22023', 'parametros_invalidos', 'p_ator_id diferente do ator autenticado de verdade é recusado'
);

select throws_ok(
  format($f$ select financeiro.sso_complementar_faturavel_mediado(%L,%L,gen_random_uuid(),gen_random_uuid(),1,gen_random_uuid(),gen_random_uuid(),5000,'teste') $f$,
    '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002'),
  '42501', 'sem_acesso', 'item base inexistente (ou de outro Cliente) é recusado'
);

select (financeiro.sso_complementar_faturavel_mediado('18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002',
  '18200000-0000-4000-8000-000000000031', '18200000-0000-4000-8000-000000000004', 1,
  '18200000-0000-4000-8000-000000000005', '18200000-0000-4000-8000-000000000006', 5000, 'Serviço extra solicitado em campo')) as complemento_1 \gset
select is((:'complemento_1'::jsonb->>'revision')::int, 2, 'complemento aceito, revisão do item base incrementa');
select is(:'complemento_1'::jsonb->'linkedIds'->>'complementoId', '18200000-0000-4000-8000-000000000005', 'linkedIds aponta pro item complemento criado');

reset role;
select is(
  (select item_base_id from financeiro.itens_faturaveis where id = '18200000-0000-4000-8000-000000000005'),
  '18200000-0000-4000-8000-000000000004', 'item complemento referencia a origem base certa'
);
select is(
  (select complemento_id from financeiro.itens_faturaveis where id = '18200000-0000-4000-8000-000000000005'),
  '18200000-0000-4000-8000-000000000006', 'complemento_id gravado junto (identidade item_base_id/complemento_id anda em par)'
);
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_complementar_faturavel_mediado(%L,%L,gen_random_uuid(),%L,1,gen_random_uuid(),gen_random_uuid(),1000,'complemento sobre complemento') $f$,
    '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002', '18200000-0000-4000-8000-000000000005'),
  '23514', 'base_invalida', 'complemento nunca vira base de outro complemento (nunca encadeia)'
);

select is(
  (financeiro.sso_complementar_faturavel_mediado('18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002',
    '18200000-0000-4000-8000-000000000031', '18200000-0000-4000-8000-000000000004', 1,
    '18200000-0000-4000-8000-000000000005', '18200000-0000-4000-8000-000000000006', 5000, 'Serviço extra solicitado em campo'))::jsonb->>'revision',
  :'complemento_1'::jsonb->>'revision', 'replay do mesmo requestId devolve o mesmo resultado, sem duplicar'
);

select throws_ok(
  format($f$ select financeiro.sso_complementar_faturavel_mediado(%L,%L,gen_random_uuid(),%L,1,gen_random_uuid(),gen_random_uuid(),1000,'teste') $f$,
    '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002', '18200000-0000-4000-8000-000000000004'),
  '40001', 'revisao_divergente', 'expected_revision desatualizado (1, já virou 2) é recusado'
);

reset role;
select throws_ok(
  format($f$ insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,competencia) values(gen_random_uuid(),%L,'despesa_visita',%L,200000,'2026-11-01') $f$,
    '18200000-0000-4000-8000-000000000002', '18200000-0000-4000-8000-000000000099'),
  '23505', null, 'índice único parcial impede segunda origem base pro mesmo (cliente,origem_tipo,origem_id)'
);

set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_listar_alocacoes_mediada(%L,%L,%L,null) $f$,
    '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-000000000002', '18200000-0000-4000-8000-000000000004'),
  '55000', 'consulta_desabilitada', 'gate de leitura mediada fechado por padrão recusa a consulta'
);

select * from finish();
rollback;
