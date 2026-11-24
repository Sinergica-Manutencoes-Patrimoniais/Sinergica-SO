-- E01-S203 — Plano PMOC criado à mão pelo PCM a partir de um Contrato PMOC (ADR-1698, decisão (b)).
--
-- O QUE ESTA PROVA EXISTE PARA IMPEDIR, antes de qualquer outra coisa:
--   1. que alguém volte a transformar a decisão (b) na decisão (a) — criação em massa. A asserção
--      central mede que, com a máquina instalada e NINGUÉM clicando, o número de Planos continua
--      exatamente o mesmo de antes. Migration que crie Plano sozinha reprova aqui.
--   2. que dois Planos nasçam para o mesmo Contrato PMOC (erro nomeado `contrato_pmoc_ja_tem_plano`).
--   3. que o segundo clique vire um segundo Plano (idempotência por `request_id`).
--   4. que o Contrato PMOC seja consumido, movido ou alterado pela criação do Plano — ele continua
--      sendo a execução legal, intacto, com o cronograma que já tinha.
-- Cobre permitido E negado, e confere RLS FORCE em toda tabela tocada.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(43);

-- ── Fixture ──────────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('20300000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's203-pcm@test.local',        crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('20300000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's203-sem-acesso@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('20300000-0000-4000-8000-000000000001', 'superadmin', 'S203 PCM', true),
 ('20300000-0000-4000-8000-000000000002', 'superadmin', 'S203 Sem concessão', true);

insert into pcm.clientes (id, nome, ativo, created_by) values
 ('20300000-0000-4000-8000-000000000010', '[TESTE] Cliente S203',         true, '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000011', '[TESTE] Cliente S203 vizinho', true, '20300000-0000-4000-8000-000000000001');

-- Imóveis PMOC: um do Cliente, um do vizinho e um ÓRFÃO (sem Cliente) — este último é o caso de
-- dado real que impede "faltam zero contratos" de ser alcançável por recorte de Cliente.
insert into pcm.pmoc_properties (id, client_id, name, type, city, created_by) values
 ('20300000-0000-4000-8000-000000000020', '20300000-0000-4000-8000-000000000010', 'Edifício Guainumbi', 'comercial', 'Campinas', '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000021', '20300000-0000-4000-8000-000000000011', 'Edifício Vizinho',   'comercial', 'Campinas', '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000022', null,                                   'Imóvel sem Cliente', 'comercial', 'Campinas', '20300000-0000-4000-8000-000000000001');

insert into pcm.pmoc_contracts (id, property_id, crea, art_number, art_date, start_date, end_date, status, created_by) values
 -- C1: o contrato que o PCM vai converter em Plano.
 ('20300000-0000-4000-8000-000000000030', '20300000-0000-4000-8000-000000000020', 'CREA-SP 123', 'ART-2026-1', date '2026-01-10', date '2026-01-01', date '2026-12-31', 'ativo', '20300000-0000-4000-8000-000000000001'),
 -- C2: segundo contrato do mesmo Cliente, deixado de fora — é o "ainda falta" do indicador.
 ('20300000-0000-4000-8000-000000000031', '20300000-0000-4000-8000-000000000020', 'CREA-SP 123', 'ART-2026-2', date '2026-02-10', date '2026-02-01', date '2027-01-31', 'renovar', '20300000-0000-4000-8000-000000000001'),
 -- C3: contrato do Cliente vizinho — pedir este explicitamente tem de ser NEGADO.
 ('20300000-0000-4000-8000-000000000032', '20300000-0000-4000-8000-000000000021', null, 'ART-2026-3', date '2026-03-10', date '2026-03-01', date '2027-02-28', 'ativo', '20300000-0000-4000-8000-000000000001'),
 -- C4: contrato do imóvel órfão.
 ('20300000-0000-4000-8000-000000000033', '20300000-0000-4000-8000-000000000022', null, 'ART-2026-4', date '2026-04-10', date '2026-04-01', date '2027-03-31', 'ativo', '20300000-0000-4000-8000-000000000001'),
 -- C5: contrato encerrado e soft-deleted — não é pendência nem conta no total.
 ('20300000-0000-4000-8000-000000000034', '20300000-0000-4000-8000-000000000020', null, 'ART-2025-9', date '2025-01-10', date '2025-01-01', date '2025-12-31', 'encerrado', '20300000-0000-4000-8000-000000000001');
update pcm.pmoc_contracts set deleted_at = now() where id = '20300000-0000-4000-8000-000000000034';

-- Dois equipamentos ativos e um inativo: a herança conta ativos, não o inventário histórico.
insert into pcm.pmoc_equipment (id, property_id, tag, type, active, created_by) values
 ('20300000-0000-4000-8000-000000000040', '20300000-0000-4000-8000-000000000020', 'AC-01', 'split-hiwall', true,  '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000041', '20300000-0000-4000-8000-000000000020', 'AC-02', 'cassete',      true,  '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000042', '20300000-0000-4000-8000-000000000020', 'AC-03', 'janeleiro',    false, '20300000-0000-4000-8000-000000000001');

-- Cronograma do C1: a periodicidade derivada é 'mensal' + 'trimestral'. A visita CANCELADA não
-- entra — cronograma cancelado não é periodicidade herdada.
insert into pcm.pmoc_schedules (id, contract_id, property_id, scheduled_date, maintenance_type, month_ref, year_ref, status, created_by) values
 ('20300000-0000-4000-8000-000000000050', '20300000-0000-4000-8000-000000000030', '20300000-0000-4000-8000-000000000020', date '2026-01-15', 'mensal',     1, 2026, 'realizado', '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000051', '20300000-0000-4000-8000-000000000030', '20300000-0000-4000-8000-000000000020', date '2026-02-15', 'mensal',     2, 2026, 'agendado',  '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000052', '20300000-0000-4000-8000-000000000030', '20300000-0000-4000-8000-000000000020', date '2026-03-15', 'trimestral', 3, 2026, 'agendado',  '20300000-0000-4000-8000-000000000001'),
 ('20300000-0000-4000-8000-000000000053', '20300000-0000-4000-8000-000000000030', '20300000-0000-4000-8000-000000000020', date '2026-04-15', 'anual',      4, 2026, 'cancelado', '20300000-0000-4000-8000-000000000001');

-- Só o usuário (1) tem `plano.gerir`, e só no Cliente S203. O (2) fica sem nenhuma concessão.
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('20300000-0000-4000-8000-000000000001', 'plano.gerir', '20300000-0000-4000-8000-000000000010');

-- Fotografia do "antes": é contra ela que se prova que esta migration NÃO criou Plano nenhum.
create temporary table s203_antes on commit drop as
  select (select count(*) from pcm.planos_manutencao)  as planos,
         (select count(*) from pcm.pmoc_contracts)     as contratos,
         (select count(*) from pcm.pmoc_schedules)     as agendamentos;
-- A fotografia é lida também sob `authenticated` mais adiante: sem o GRANT, o teste pararia
-- por privilégio de tabela temporária em vez de medir o que veio medir.
grant select on s203_antes to authenticated;

-- ── RLS FORCE em toda tabela tocada ──────────────────────────────────────────────────────────
select is(
  (select count(*) from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'pcm'
      and c.relname in ('sso_vinculos_plano_contrato_pmoc', 'planos_manutencao', 'plano_comandos',
                        'pmoc_contracts', 'pmoc_properties', 'pmoc_equipment', 'pmoc_schedules')
      and c.relrowsecurity and c.relforcerowsecurity),
  7::bigint,
  'RLS FORCE ligada nas 7 tabelas que a criação mediada toca'
);

-- ── A decisão (b): a migration instalou a máquina e NÃO criou Plano nenhum ───────────────────
select is(
  (select count(*) from pcm.planos_manutencao where modalidade = 'pmoc'),
  0::bigint,
  'decisão (b): nenhum Plano PMOC nasceu de migração de conteúdo — a criação é manual'
);
select is(
  (select count(*) from pcm.sso_vinculos_plano_contrato_pmoc), 0::bigint,
  'decisão (b): nenhum vínculo Contrato↔Plano foi fabricado pela migration'
);

-- ── NEGADO: gate fechado se anuncia com erro NOMEADO, nunca com lista vazia ──────────────────
-- Os dois gates nascem fechados nas migrations `0513` e `0143`, MAS os scripts `manual_*.sql`
-- deste mesmo diretório os abrem e dão commit. Rodando a suíte inteira, o estado herdado seria
-- "aberto" e esta asserção passaria por engano sem nunca exercitar o gate. Fechar explicitamente
-- aqui (dentro da transação, desfeito no rollback) torna o teste determinístico nos dois modos.
set local role postgres;
update pcm.sso_pmoc_mediado_gate     set habilitado = false where id;
update pcm.sso_diagnostico_pmoc_gate set habilitado = false where id;
set local role authenticated;
set local request.jwt.claims = '{"sub":"20300000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000060','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000030', null, true) $$,
  '55000', 'operacao_desabilitada',
  'gate fechado por padrão recusa a criação com erro nomeado'
);
select throws_ok(
  $$ select * from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010', 100) $$,
  '55000', 'operacao_desabilitada',
  'gate fechado recusa o indicador com erro nomeado — "nenhum contrato pendente" seria mentira'
);
select throws_ok(
  $$ select * from pcm.sso_resumir_cobertura_plano_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010') $$,
  '55000', 'operacao_desabilitada',
  'gate fechado recusa o resumo de cobertura com erro nomeado'
);

set local role postgres;
update pcm.sso_pmoc_mediado_gate    set habilitado = true where id;
set local role authenticated;
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000060','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000030', null, true) $$,
  '55000', 'fonte_desabilitada',
  'o segundo gate reusado (diagnóstico PMOC) também se anuncia com erro próprio'
);
set local role postgres;
update pcm.sso_diagnostico_pmoc_gate set habilitado = true where id;
set local role authenticated;

-- ── NEGADO: sem a capacidade `plano.gerir` ───────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"20300000-0000-4000-8000-000000000002","role":"authenticated","user_role":"superadmin"}';
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000002','20300000-0000-4000-8000-000000000061','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000030', null, true) $$,
  '42501', 'sem_acesso',
  'sem concessão de plano.gerir a criação é negada, não silenciosamente ignorada'
);
select throws_ok(
  $$ select * from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000002','20300000-0000-4000-8000-000000000010', 100) $$,
  '42501', 'sem_acesso',
  'sem capacidade o indicador é NEGADO, nunca devolvido vazio'
);

set local request.jwt.claims = '{"sub":"20300000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

-- ── NEGADO: a criação nunca acontece sozinha ─────────────────────────────────────────────────
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000062','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000030', null, false) $$,
  '22023', 'criacao_nao_confirmada',
  'sem confirmação humana explícita a RPC recusa — é a trava da decisão (b)'
);
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000063','20300000-0000-4000-8000-000000000010', null, null, true) $$,
  '22023', 'parametros_invalidos',
  'parâmetro ausente é recusado antes de qualquer leitura de dado'
);
select is(
  has_function_privilege('anon', 'pcm.sso_criar_plano_do_contrato_pmoc(uuid,uuid,uuid,uuid,text,boolean)', 'execute'),
  false, 'anon não executa a criação de Plano PMOC'
);
select is(
  has_function_privilege('service_role', 'pcm.sso_criar_plano_do_contrato_pmoc(uuid,uuid,uuid,uuid,text,boolean)', 'execute'),
  false, 'service_role não executa a criação — nenhum job ou Edge Function cria Plano sozinho'
);

-- ── NEGADO: contrato de outro Cliente e contrato sem Cliente ─────────────────────────────────
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000064','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000032', null, true) $$,
  '42501', 'contrato_pmoc_indisponivel',
  'pedir o Contrato PMOC de outro Cliente é negado, não redirecionado'
);
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000065','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000033', null, true) $$,
  '23514', 'contrato_pmoc_sem_cliente',
  'contrato cujo imóvel não tem Cliente tem erro PRÓPRIO — o Cliente não é adivinhado'
);
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000066','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000034', null, true) $$,
  '42501', 'contrato_pmoc_indisponivel',
  'contrato soft-deleted não ressuscita como Plano'
);

-- ── O indicador ANTES de qualquer criação ────────────────────────────────────────────────────
select is(
  (select count(*) from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010', 100)),
  2::bigint, 'o indicador vê os dois Contratos PMOC vivos do Cliente como pendentes'
);
select is(
  (select contratos_sem_plano from pcm.sso_resumir_cobertura_plano_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010')),
  2, 'o resumo começa dizendo que faltam dois'
);
select is(
  (select periodicidades from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010', 100)
    where contrato_id = '20300000-0000-4000-8000-000000000030'),
  array['mensal', 'trimestral'],
  'a periodicidade listada vem do cronograma vivo; a visita cancelada não entra'
);
select is(
  (select equipamentos_ativos from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010', 100)
    where contrato_id = '20300000-0000-4000-8000-000000000030'),
  2, 'o indicador mostra os equipamentos ATIVOS do imóvel, não o inventário histórico'
);
select is(
  (select count(*) from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010', 100)
    where contrato_id in ('20300000-0000-4000-8000-000000000032','20300000-0000-4000-8000-000000000033')),
  0::bigint, 'contrato de outro Cliente e contrato órfão não vazam para a lista deste Cliente'
);
select is(
  (select contratos_sem_cliente from pcm.sso_resumir_cobertura_plano_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010')),
  1, 'o resumo conta o contrato órfão à parte — sem isso "faltam zero" nunca fecharia'
);

-- ── PERMITIDO: a criação manual ──────────────────────────────────────────────────────────────
select is(
  (select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000070','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000030', null, true) ->> 'modalidade'),
  'pmoc', 'o Plano criado nasce na modalidade pmoc de 1869'
);
select is(
  (select p.nome from pcm.planos_manutencao p
     join pcm.sso_vinculos_plano_contrato_pmoc v on v.plano_id = p.id
    where v.contrato_pmoc_id = '20300000-0000-4000-8000-000000000030'),
  'PMOC — Edifício Guainumbi',
  'o nome é herdado do imóvel do contrato quando o PCM não dá outro'
);
select is(
  (select p.estado || '/' || p.revisao::text from pcm.planos_manutencao p
     join pcm.sso_vinculos_plano_contrato_pmoc v on v.plano_id = p.id
    where v.contrato_pmoc_id = '20300000-0000-4000-8000-000000000030'),
  'rascunho/1',
  'o Plano entra pelo mesmo começo de 0260: rascunho, revisão 1 — não pula aprovação'
);
select is(
  (select v.derivado -> 'periodicidades' from pcm.sso_vinculos_plano_contrato_pmoc v
    where v.contrato_pmoc_id = '20300000-0000-4000-8000-000000000030'),
  '["mensal", "trimestral"]'::jsonb,
  'o vínculo guarda a fotografia do que foi herdado do cronograma'
);
select is(
  (select v.derivado ->> 'artNumero' from pcm.sso_vinculos_plano_contrato_pmoc v
    where v.contrato_pmoc_id = '20300000-0000-4000-8000-000000000030'),
  'ART-2026-1', 'a ART do contrato fica registrada no vínculo, legível sem abrir o PMOC'
);

-- ── O Contrato PMOC continua intacto: Plano é correspondência, não consumo ───────────────────
-- Medido como `postgres`: a contagem precisa enxergar a TABELA INTEIRA. Sob `authenticated` a
-- RLS filtraria as linhas e um "nada mudou" seria indistinguível de "nada é visível".
set local role postgres;
select is(
  (select count(*) from pcm.pmoc_contracts), (select contratos from s203_antes),
  'nenhum Contrato PMOC foi criado, movido nem apagado pela criação do Plano'
);
select is(
  (select count(*) from pcm.pmoc_schedules), (select agendamentos from s203_antes),
  'o cronograma de visitas do contrato permanece exatamente como estava'
);
select is(
  (select count(*) from pcm.rotinas_manutencao r
     join pcm.sso_vinculos_plano_contrato_pmoc v on v.plano_id = r.plano_id),
  0::bigint,
  'a criação não fabrica Rotina: uma Rotina por equipamento × visita seria a alternativa (a)'
);
select is(
  (select count(*) from audit.events where action = 'plano.criado_do_contrato_pmoc'),
  1::bigint, 'a criação deixa um evento de auditoria nomeado'
);
set local role authenticated;

-- ── Idempotência por `request_id` ────────────────────────────────────────────────────────────
select is(
  (select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000070','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000030', null, true) ->> 'planoId'),
  (select v.plano_id::text from pcm.sso_vinculos_plano_contrato_pmoc v
    where v.contrato_pmoc_id = '20300000-0000-4000-8000-000000000030'),
  'repetir o mesmo request_id devolve o MESMO recibo — o segundo clique não cria outro Plano'
);
select is(
  (select count(*) from pcm.planos_manutencao where modalidade = 'pmoc'),
  1::bigint, 'depois do pedido repetido continua existindo exatamente um Plano PMOC'
);
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000070','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000031', null, true) $$,
  '23505', 'request_id_conflitante',
  'o mesmo request_id com outro contrato é conflito nomeado, nunca um Plano no lugar errado'
);

-- ── Dois Planos para o mesmo Contrato é RECUSADO ─────────────────────────────────────────────
select throws_ok(
  $$ select pcm.sso_criar_plano_do_contrato_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000071','20300000-0000-4000-8000-000000000010','20300000-0000-4000-8000-000000000030', null, true) $$,
  '23505', 'contrato_pmoc_ja_tem_plano',
  'um Contrato PMOC não ganha um segundo Plano — erro nomeado, não duplicata silenciosa'
);
select throws_ok(
  $$ insert into pcm.sso_vinculos_plano_contrato_pmoc (request_id, cliente_id, contrato_pmoc_id, plano_id, imovel_id, derivado, ator_id)
     select '20300000-0000-4000-8000-000000000072', '20300000-0000-4000-8000-000000000010', '20300000-0000-4000-8000-000000000030', p.id, '20300000-0000-4000-8000-000000000020', '{}'::jsonb, '20300000-0000-4000-8000-000000000001'
       from pcm.planos_manutencao p limit 1 $$,
  '42501', null,
  'nem por escrita direta: `authenticated` não tem INSERT no vínculo — só a RPC escreve'
);

-- ── O vínculo é append-only ──────────────────────────────────────────────────────────────────
set local role postgres;
select throws_ok(
  $$ update pcm.sso_vinculos_plano_contrato_pmoc set derivado = '{}'::jsonb $$,
  '23514', 'conferencia_imutavel',
  'o vínculo não pode ser reescrito: declaração datada do PCM não se edita'
);
select throws_ok(
  $$ delete from pcm.sso_vinculos_plano_contrato_pmoc $$,
  '23514', 'conferencia_imutavel',
  'nem apagado — o reverso de um Plano é o fluxo de Plano, não um delete'
);
select throws_ok(
  $$ insert into pcm.sso_vinculos_plano_contrato_pmoc (request_id, cliente_id, contrato_pmoc_id, plano_id, imovel_id, derivado, ator_id)
     select '20300000-0000-4000-8000-000000000073', '20300000-0000-4000-8000-000000000010', '20300000-0000-4000-8000-000000000031', p.id, '20300000-0000-4000-8000-000000000020', '{}'::jsonb, '20300000-0000-4000-8000-000000000001'
       from pcm.sso_vinculos_plano_contrato_pmoc v join pcm.planos_manutencao p on p.id = v.plano_id limit 1 $$,
  '23505', null,
  'um Plano também não corresponde a dois Contratos — a unicidade vale dos dois lados'
);
set local role authenticated;

-- ── O indicador DEPOIS: progresso visível ────────────────────────────────────────────────────
select is(
  (select count(*) from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010', 100)),
  1::bigint, 'o contrato que ganhou Plano sai da lista de pendentes'
);
select is(
  (select contrato_id from pcm.sso_listar_contratos_pmoc_sem_plano('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010', 100)),
  '20300000-0000-4000-8000-000000000031'::uuid,
  'o que sobra na lista é exatamente o contrato ainda não convertido'
);
select results_eq(
  $$ select contratos_total, contratos_com_plano, contratos_sem_plano, planos_modalidade_pmoc
       from pcm.sso_resumir_cobertura_plano_pmoc('20300000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000010') $$,
  $$ values (2, 1, 1, 1) $$,
  'o resumo mostra o progresso: 1 de 2 convertidos — é o que permitirá um dia tirar PMOC do menu'
);
select is(
  (select count(*) from pcm.planos_manutencao), (select planos from s203_antes) + 1,
  'ao todo, exatamente um Plano nasceu — e nasceu de um clique, não de uma migração de conteúdo'
);

select * from finish();
rollback;
