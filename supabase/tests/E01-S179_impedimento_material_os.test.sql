-- E01-S179 US2 (AC-5: material indisponível impede OS sem apagar/alterar tarefa remota) — prova
-- real de pcm.sso_declarar_impedimento_material_os/sso_listar_impedimentos_material_os (1354).
-- Auditoria de 2026-11-10 encontrou zero pgTAP pra US2 inteira (disponibilidade/exceção/
-- impedimento) apesar de schema/RPC reais — primeira prova real desta fatia.
begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17910000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's179-impedimento@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('17910000-0000-4000-8000-000000000001', 'superadmin', 'S179 Impedimento', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17910000-0000-4000-8000-000000000002', 'Cliente S179 A', true, '17910000-0000-4000-8000-000000000001'),
 ('17910000-0000-4000-8000-000000000003', 'Cliente Divergente S179', true, '17910000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('17910000-0000-4000-8000-000000000001', 'material.gerir', '17910000-0000-4000-8000-000000000002'),
 ('17910000-0000-4000-8000-000000000001', 'visita.confirmar', '17910000-0000-4000-8000-000000000002');
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, created_by) values
 ('17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000002', 'OS-S179-IMP', 'OS com impedimento de material', 'corretiva', 'em_execucao', '17910000-0000-4000-8000-000000000001');

-- `sso_registrar_lista_materiais`/`sso_informar_material` (núcleo, 0322/0328) perderam o grant pra
-- `authenticated` em 1059/1061 — caminho real é a versão "_mediada"/"_mediado", cada uma atrás do
-- seu próprio gate (mesmo padrão "mediada" já visto em várias stories desta sessão).
update pcm.sso_criacao_materiais_mediada_gate set habilitado = true where id;
update pcm.sso_eventos_materiais_mediados_gate set habilitado = true where id;

set local request.jwt.claims = '{"sub":"17910000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select (pcm.sso_registrar_lista_materiais_mediada(gen_random_uuid(), 0, '17910000-0000-4000-8000-000000000005',
  '17910000-0000-4000-8000-000000000004', 'sinergica', 'Disjuntor 63A, cabo 2.5mm')) as recibo_lista \gset
select ok(:'recibo_lista'::jsonb->>'aggregateId' is not null, 'lista de materiais da OS é criada (fixture)');

-- Evento tipo 'disponibilidade' (revisão 2) — NÃO é exceção; usado pra provar origem_invalida.
select (pcm.sso_informar_material_mediado(gen_random_uuid(), '17910000-0000-4000-8000-000000000005', 1, 'disponibilidade',
  '{"situacao":"parcial"}'::jsonb)) as recibo_disponibilidade \gset
-- Evento tipo 'excecao' (revisão 3) — este é o evento real de origem do impedimento.
select (pcm.sso_informar_material_mediado(gen_random_uuid(), '17910000-0000-4000-8000-000000000005', 2, 'excecao',
  '{"motivo":"faltante","descricao":"Disjuntor 63A sem previsão de entrega do fornecedor"}'::jsonb)) as recibo_excecao \gset
select is((:'recibo_excecao'::jsonb->>'revision')::int, 3, 'evento de exceção nasce na revisão 3 da lista (fixture)');

reset role;

select throws_ok(
  format($f$ select pcm.sso_declarar_impedimento_material_os(%L,%L,gen_random_uuid(),%L,%L,3,0,'suspenso','Material indisponível, suspendendo OS') $f$,
    '17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005'),
  '55000', 'impedimento_desabilitado', 'gate fechado por padrão recusa o impedimento'
);

reset role;
update pcm.sso_impedimento_material_os_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"17910000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_declarar_impedimento_material_os(%L,%L,gen_random_uuid(),%L,%L,1,0,'suspenso','teste') $f$,
    '17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005'),
  '22023', 'parametros_invalidos', 'evento_revision menor que 2 é recusado (exceção só existe a partir da revisão 2)'
);

select throws_ok(
  format($f$ select pcm.sso_declarar_impedimento_material_os(%L,%L,gen_random_uuid(),%L,%L,2,0,'suspenso','teste') $f$,
    '17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005'),
  '23514', 'origem_invalida', 'evento de disponibilidade (não exceção) nunca origina impedimento'
);

select (pcm.sso_declarar_impedimento_material_os('17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002',
  '17910000-0000-4000-8000-000000000031', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005', 3, 0,
  'suspenso', 'Material indisponível, suspendendo OS')) as impedimento_1 \gset
select is((:'impedimento_1'::jsonb->>'revision')::int, 1, 'primeiro impedimento (suspenso) é aceito, revisão 1');
select is(:'impedimento_1'::jsonb->>'efeitoRemoto', 'false', 'declarar impedimento nunca afirma efeito remoto (não mexe na tarefa Auvo)');
select is(:'impedimento_1'::jsonb->>'osAlterada', 'false', 'declarar impedimento nunca afirma ter alterado a OS de verdade');

select throws_ok(
  format($f$ select pcm.sso_declarar_impedimento_material_os(%L,%L,gen_random_uuid(),%L,%L,3,0,'suspenso','teste') $f$,
    '17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005'),
  '40001', 'revisao_obsoleta', 'expected_revision desatualizado (0, já virou 1) é recusado'
);

select throws_ok(
  format($f$ select pcm.sso_declarar_impedimento_material_os(%L,%L,gen_random_uuid(),%L,%L,3,1,'suspenso','teste') $f$,
    '17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005'),
  '23514', 'transicao_invalida', 'suspender de novo um impedimento já suspenso é recusado'
);

select (pcm.sso_declarar_impedimento_material_os('17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002',
  '17910000-0000-4000-8000-000000000032', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005', 3, 1,
  'retomado', 'Material chegou, retomando OS')) as impedimento_2 \gset
select is((:'impedimento_2'::jsonb->>'revision')::int, 2, 'retomar o impedimento correto (mesma lista/evento) é aceito, revisão 2');

select throws_ok(
  format($f$ select pcm.sso_declarar_impedimento_material_os(%L,%L,gen_random_uuid(),%L,%L,3,2,'retomado','teste') $f$,
    '17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005'),
  '23514', 'transicao_invalida', 'retomar de novo um impedimento já retomado é recusado'
);

select is(
  (pcm.sso_declarar_impedimento_material_os('17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002',
    '17910000-0000-4000-8000-000000000031', '17910000-0000-4000-8000-000000000004', '17910000-0000-4000-8000-000000000005', 3, 0,
    'suspenso', 'Material indisponível, suspendendo OS'))::jsonb->>'revision',
  :'impedimento_1'::jsonb->>'revision', 'replay do mesmo requestId devolve o mesmo resultado, sem reprocessar'
);

select is(
  (select count(*)::int from pcm.sso_listar_impedimentos_material_os('17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000002', '17910000-0000-4000-8000-000000000004', null, 10)),
  2, 'histórico lista as duas transições (suspenso + retomado)'
);

select throws_ok(
  format($f$ select pcm.sso_listar_impedimentos_material_os(%L,%L,%L,null,10) $f$,
    '17910000-0000-4000-8000-000000000001', '17910000-0000-4000-8000-000000000003', '17910000-0000-4000-8000-000000000004'),
  '42501', 'sem_acesso', 'Cliente divergente não lê histórico de impedimento de outro Cliente'
);

reset role;
select throws_ok(
  $$ update pcm.sso_impedimento_material_os_eventos set motivo = 'editado' where true $$,
  '23514', 'nota_imutavel', 'histórico de impedimento é append-only, nunca editado'
);

select * from finish();
rollback;
