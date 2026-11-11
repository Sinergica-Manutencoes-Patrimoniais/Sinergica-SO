-- E01-S182 (alocação de documento + estorno de alocação, 0401/0404/1559/1560) — prova real de
-- ponta a ponta: alocar documento até fechar o saldo do item (vira 'faturado') → tentar alocar
-- além do saldo é recusado → estornar devolve o item pra 'conferido' → estornar de novo (já
-- revertido) é recusado → listagem reflete o estorno. Continuação do fechamento de S182 (111
-- migrations, cobertura pgTAP ainda fina).
begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18210000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-alocacao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('18210000-0000-4000-8000-000000000001', 'superadmin', 'S182 Alocação', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18210000-0000-4000-8000-000000000002', 'Cliente S182 Alocação', true, '18210000-0000-4000-8000-000000000001'),
 ('18210000-0000-4000-8000-000000000003', 'Cliente Divergente S182 Alocação', true, '18210000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18210000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18210000-0000-4000-8000-000000000002');
insert into financeiro.itens_faturaveis (id, cliente_id, origem_tipo, origem_id, valor_original_centavos, valor_conferido_centavos, competencia, status, revisao) values
 ('18210000-0000-4000-8000-000000000004', '18210000-0000-4000-8000-000000000002', 'despesa_visita', '18210000-0000-4000-8000-000000000099', 100000, 100000, '2026-11-01', 'conferido', 1);
insert into financeiro.categorias (id, nome, tipo) values
 ('18210000-0000-4000-8000-000000000005', 'Receita de serviço (teste)', 'entrada');
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id) values
 ('18210000-0000-4000-8000-000000000006', 'entrada', 'previsto', 100000, '2026-11-05', '2026-11-20', '18210000-0000-4000-8000-000000000005', '18210000-0000-4000-8000-000000000002');

set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_alocar_documento_mediado(%L,%L,gen_random_uuid(),gen_random_uuid(),%L,1,%L,'NF-001','2026-11-05',100000) $f$,
    '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', '18210000-0000-4000-8000-000000000006'),
  '55000', 'alocacao_desabilitada', 'gate de alocação mediada fechado por padrão recusa'
);

reset role;
update financeiro.sso_alocacao_documento_mediada_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_alocar_documento_mediado(%L,%L,gen_random_uuid(),gen_random_uuid(),%L,1,%L,'NF-001','2026-11-05',100000) $f$,
    '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', '18210000-0000-4000-8000-000000000006'),
  '55000', 'faturamento_indisponivel', 'gate principal de faturamento fechado recusa mesmo com a mediação aberta'
);

reset role;
update financeiro.sso_faturamento_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select (financeiro.sso_alocar_documento_mediado('18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002',
  '18210000-0000-4000-8000-000000000031', '18210000-0000-4000-8000-000000000007', '18210000-0000-4000-8000-000000000004', 1,
  '18210000-0000-4000-8000-000000000006', 'NF-001', '2026-11-05', 100000)) as alocacao_1 \gset
select is(:'alocacao_1'::jsonb->>'state', 'faturado', 'alocação que fecha o saldo exato vira faturado');
select is((:'alocacao_1'::jsonb->>'saldoCentavos')::int, 0, 'saldo zera quando a alocação cobre o valor conferido inteiro');

select is(
  (financeiro.sso_alocar_documento_mediado('18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002',
    '18210000-0000-4000-8000-000000000031', '18210000-0000-4000-8000-000000000007', '18210000-0000-4000-8000-000000000004', 1,
    '18210000-0000-4000-8000-000000000006', 'NF-001', '2026-11-05', 100000))::jsonb->>'state',
  :'alocacao_1'::jsonb->>'state', 'replay do mesmo requestId devolve o mesmo resultado, sem duplicar alocação'
);

select throws_ok(
  format($f$ select financeiro.sso_alocar_documento_mediado(%L,%L,gen_random_uuid(),gen_random_uuid(),%L,2,%L,'NF-001','2026-11-05',1) $f$,
    '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', '18210000-0000-4000-8000-000000000006'),
  '23514', 'estado_invalido', 'item já faturado (saldo fechado) recusa qualquer nova alocação, nem chega a conferir saldo'
);

select throws_ok(
  format($f$ select financeiro.sso_alocar_documento_mediado(%L,%L,gen_random_uuid(),gen_random_uuid(),%L,2,%L,'NF-001','2026-11-05',1) $f$,
    '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000003', '18210000-0000-4000-8000-000000000004', '18210000-0000-4000-8000-000000000006'),
  '42501', 'sem_acesso', 'item de outro Cliente (não encontrado sob esse clienteId) nunca aloca'
);

reset role;
update financeiro.sso_correcao_faturavel_mediada_gate set leitura = true, escrita = true where id;
set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select is(
  (select count(*)::int from financeiro.sso_listar_alocacoes_mediada('18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', null)),
  1, 'listagem mostra a alocação criada'
);
select is(
  (select estornada from financeiro.sso_listar_alocacoes_mediada('18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', null) limit 1),
  false, 'alocação ainda não está estornada'
);

select throws_ok(
  format($f$ select financeiro.sso_estornar_alocacao_mediada(%L,%L,gen_random_uuid(),gen_random_uuid(),%L,1,%L,'motivo') $f$,
    '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', '18210000-0000-4000-8000-000000000007'),
  '40001', 'revisao_divergente', 'expected_revision desatualizado (1, item já está na revisão 2 após a alocação) é recusado'
);

select (financeiro.sso_estornar_alocacao_mediada('18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002',
  '18210000-0000-4000-8000-000000000032', '18210000-0000-4000-8000-000000000008', '18210000-0000-4000-8000-000000000004', 2,
  '18210000-0000-4000-8000-000000000007', 'Nota fiscal cancelada pelo Cliente')) as estorno_1 \gset
select is(:'estorno_1'::jsonb->>'state', 'conferido', 'estorno devolve o item pra conferido (saldo volta a zero alocado)');
select is((:'estorno_1'::jsonb->>'saldoCentavos')::int, 100000, 'saldo disponível volta ao valor conferido inteiro após o estorno');

select is(
  (financeiro.sso_estornar_alocacao_mediada('18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002',
    '18210000-0000-4000-8000-000000000032', '18210000-0000-4000-8000-000000000008', '18210000-0000-4000-8000-000000000004', 2,
    '18210000-0000-4000-8000-000000000007', 'Nota fiscal cancelada pelo Cliente'))::jsonb->>'state',
  :'estorno_1'::jsonb->>'state', 'replay do mesmo requestId de estorno devolve o mesmo resultado, sem reprocessar'
);

select throws_ok(
  format($f$ select financeiro.sso_estornar_alocacao_mediada(%L,%L,gen_random_uuid(),gen_random_uuid(),%L,3,%L,'segunda tentativa') $f$,
    '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', '18210000-0000-4000-8000-000000000007'),
  '23514', 'estado_invalido', 'estornar de novo uma alocação já estornada (item voltou a conferido) é recusado'
);

select is(
  (select estornada from financeiro.sso_listar_alocacoes_mediada('18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-000000000002', '18210000-0000-4000-8000-000000000004', null) limit 1),
  true, 'listagem reflete a alocação como estornada'
);

select * from finish();
rollback;
