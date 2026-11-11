-- E01-S181 (dispensa de orçamento operacional, 0437/0440) — prova real de ponta a ponta: dispensar
-- → consultar (só vigente) → revogar → consultar (vazio) → dispensar de novo (novo registro após
-- revogação) → histórico completo. Auditoria de 2026-11-10 só tinha confirmado existência de
-- schema/UI; ao escrever este teste achei e corrigi (migration 1833) um bug real — as 4 RPCs nunca
-- tinham `grant execute` a `authenticated`, inalcançáveis em qualquer ambiente real.
begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18100000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's181-dispensa@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('18100000-0000-4000-8000-000000000001', 'superadmin', 'S181 Dispensa', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18100000-0000-4000-8000-000000000002', 'Cliente S181 A', true, '18100000-0000-4000-8000-000000000001'),
 ('18100000-0000-4000-8000-000000000003', 'Cliente Divergente S181', true, '18100000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18100000-0000-4000-8000-000000000001', 'orcamento.dispensar', '18100000-0000-4000-8000-000000000002'),
 ('18100000-0000-4000-8000-000000000001', 'material.gerir', '18100000-0000-4000-8000-000000000002');
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, created_by) values
 ('18100000-0000-4000-8000-000000000004', '18100000-0000-4000-8000-000000000002', 'OS-S181-DISP', 'OS com orçamento dispensado', 'corretiva', 'em_execucao', '18100000-0000-4000-8000-000000000001');

update pcm.sso_criacao_materiais_mediada_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select (pcm.sso_registrar_lista_materiais_mediada(gen_random_uuid(), 0, '18100000-0000-4000-8000-000000000005',
  '18100000-0000-4000-8000-000000000004', 'sinergica', 'Reator de partida, 3 contatores')) as recibo_lista \gset
select ok(:'recibo_lista'::jsonb->>'aggregateId' is not null, 'lista de materiais da OS é criada (fixture)');

reset role;

select throws_ok(
  format($f$ select comercial.sso_dispensar_orcamento(gen_random_uuid(),gen_random_uuid(),%L,1,'Cliente dispensou formalização') $f$, '18100000-0000-4000-8000-000000000005'),
  '55000', 'dispensa_indisponivel', 'gate fechado por padrão recusa a dispensa'
);

reset role;
update comercial.sso_dispensa_orcamento_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select comercial.sso_dispensar_orcamento(gen_random_uuid(),gen_random_uuid(),%L,1,'') $f$, '18100000-0000-4000-8000-000000000005'),
  '22023', 'parametros_invalidos', 'motivo vazio é recusado'
);

select (comercial.sso_dispensar_orcamento('18100000-0000-4000-8000-000000000031', '18100000-0000-4000-8000-000000000006',
  '18100000-0000-4000-8000-000000000005', 1, 'Cliente dispensou formalização, resolve por e-mail')) as dispensa_1 \gset
select is(:'dispensa_1'::jsonb->>'state', 'dispensado', 'primeira dispensa é aceita');

select is(
  (comercial.sso_dispensar_orcamento('18100000-0000-4000-8000-000000000031', '18100000-0000-4000-8000-000000000006',
    '18100000-0000-4000-8000-000000000005', 1, 'Cliente dispensou formalização, resolve por e-mail'))::jsonb->>'aggregateId',
  :'dispensa_1'::jsonb->>'aggregateId', 'replay do mesmo requestId devolve o mesmo resultado, sem duplicar'
);

select throws_ok(
  format($f$ select comercial.sso_dispensar_orcamento(%L,gen_random_uuid(),%L,1,'segunda tentativa') $f$,
    :'dispensa_1'::jsonb->>'requestId', '18100000-0000-4000-8000-000000000005'),
  '23505', 'request_id_conflitante', 'mesmo requestId com payload diferente é recusado'
);

select throws_ok(
  format($f$ select comercial.sso_dispensar_orcamento(gen_random_uuid(),gen_random_uuid(),%L,1,'segunda dispensa') $f$, '18100000-0000-4000-8000-000000000005'),
  '23505', 'dispensa_ja_registrada', 'segunda dispensa enquanto a primeira está vigente é recusada'
);

select is(
  (select count(*)::int from comercial.sso_consultar_dispensa('18100000-0000-4000-8000-000000000005')),
  1, 'consulta mostra a dispensa vigente'
);

select throws_ok(
  format($f$ select comercial.sso_revogar_dispensa(gen_random_uuid(),gen_random_uuid(),%L,2,'revisão errada') $f$, :'dispensa_1'::jsonb->>'aggregateId'),
  '40001', 'revisao_obsoleta', 'revisão divergente da lista é recusada na revogação'
);

select (comercial.sso_revogar_dispensa('18100000-0000-4000-8000-000000000032', '18100000-0000-4000-8000-000000000007',
  (:'dispensa_1'::jsonb->>'aggregateId')::uuid, 1, 'Cliente decidiu formalizar afinal, revogando dispensa')) as revogacao_1 \gset
select is(:'revogacao_1'::jsonb->>'state', 'revogada', 'revogação da dispensa é aceita');

select is(
  (select count(*)::int from comercial.sso_consultar_dispensa('18100000-0000-4000-8000-000000000005')),
  0, 'após revogar, consulta não mostra mais nenhuma dispensa vigente (histórico preservado à parte)'
);

select throws_ok(
  format($f$ select comercial.sso_revogar_dispensa(gen_random_uuid(),gen_random_uuid(),%L,1,'segunda revogação') $f$, :'dispensa_1'::jsonb->>'aggregateId'),
  '23505', 'dispensa_ja_revogada', 'revogar de novo a mesma dispensa é recusado'
);

select (comercial.sso_dispensar_orcamento('18100000-0000-4000-8000-000000000033', '18100000-0000-4000-8000-000000000008',
  '18100000-0000-4000-8000-000000000005', 1, 'Nova dispensa após a revogação anterior')) as dispensa_2 \gset
select is(:'dispensa_2'::jsonb->>'state', 'dispensado', 'nova dispensa após revogação da anterior é aceita (não fica travada pra sempre)');

select is(
  (select count(*)::int from comercial.sso_historico_dispensa('18100000-0000-4000-8000-000000000005')),
  3, 'histórico preserva as 3 entradas (dispensada, revogada, dispensada de novo) — nunca apaga'
);

reset role;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select comercial.sso_consultar_dispensa(%L) $f$, '18100000-0000-4000-8000-000000000009'),
  '42501', 'origem_nao_encontrada_ou_sem_acesso', 'lista inexistente (ou de outro Cliente) nunca vaza se tem dispensa'
);

select * from finish();
rollback;
