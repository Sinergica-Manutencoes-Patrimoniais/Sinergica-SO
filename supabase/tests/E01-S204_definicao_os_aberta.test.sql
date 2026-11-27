-- E01-S204_definicao_os_aberta.test.sql — pgTAP
-- Uma definição de OS aberta / backlog / pré-chamado / chamado aberto, e as contagens que a usam
-- concordam entre si: parcelas = KPI de Chamados; carteira = Visão 360 = Início por Cliente.
begin;
select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000002041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-s204-read@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000002042', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-s204-none@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by) values
  ('00000000-0000-0000-0000-0000000020aa', '[TESTE] Cliente A S204', '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020bb', '[TESTE] Cliente B S204', '00000000-0000-0000-0000-000000002041');

insert into pcm.chamados (id, numero, cliente_id, titulo, status, created_by) values
  ('00000000-0000-0000-0000-0000000020c1', 'CH-S204-1', '00000000-0000-0000-0000-0000000020aa', '[TESTE] Chamado com OS planejada', 'convertido_os', '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020c2', 'CH-S204-2', '00000000-0000-0000-0000-0000000020aa', '[TESTE] Chamado com OS em backlog', 'convertido_os', '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020c3', 'CH-S204-3', '00000000-0000-0000-0000-0000000020aa', '[TESTE] Chamado com OS em validação', 'convertido_os', '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020c4', 'CH-S204-4', '00000000-0000-0000-0000-0000000020aa', '[TESTE] Chamado aberto sem OS', 'aberto', '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020c5', 'CH-S204-5', '00000000-0000-0000-0000-0000000020aa', '[TESTE] Chamado da OS finalizada', 'convertido_os', '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020c6', 'CH-S204-6', '00000000-0000-0000-0000-0000000020bb', '[TESTE] Chamado do Cliente B', 'convertido_os', '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020c7', 'CH-S204-7', '00000000-0000-0000-0000-0000000020aa', '[TESTE] Chamado do ponto de visita', 'convertido_os', '00000000-0000-0000-0000-000000002041');

insert into pcm.ordens_servico (
  id, client_id, chamado_id, numero, titulo, categoria, status, data_agendada, auvo_task_id, created_by
) values
  -- OS aberta já planejada (tem data): conta como OS aberta, não como backlog.
  ('00000000-0000-0000-0000-0000000020d1', '00000000-0000-0000-0000-0000000020aa', '00000000-0000-0000-0000-0000000020c1', 'OS-S204-1', '[TESTE] OS planejada', 'corretiva', 'planejamento', now() + interval '1 day', null, '00000000-0000-0000-0000-000000002041'),
  -- OS aberta sem data, técnico nem tarefa Auvo: backlog (e OS aberta).
  ('00000000-0000-0000-0000-0000000020d2', '00000000-0000-0000-0000-0000000020aa', '00000000-0000-0000-0000-0000000020c2', 'OS-S204-2', '[TESTE] OS em backlog', 'corretiva', 'solicitacao', null, null, '00000000-0000-0000-0000-000000002041'),
  -- D2: Validação PCM conta como aberta.
  ('00000000-0000-0000-0000-0000000020d3', '00000000-0000-0000-0000-0000000020aa', '00000000-0000-0000-0000-0000000020c3', 'OS-S204-3', '[TESTE] OS em validação', 'corretiva', 'validacao_pcm', null, 920420003, '00000000-0000-0000-0000-000000002041'),
  -- D1: pré-chamado (sem Chamado) fica à parte.
  ('00000000-0000-0000-0000-0000000020d4', '00000000-0000-0000-0000-0000000020aa', null, 'PRE-S204-4', '[TESTE] Pré-chamado', 'corretiva', 'solicitacao', null, null, '00000000-0000-0000-0000-000000002041'),
  -- Histórico: não conta.
  ('00000000-0000-0000-0000-0000000020d5', '00000000-0000-0000-0000-0000000020aa', '00000000-0000-0000-0000-0000000020c5', 'OS-S204-5', '[TESTE] OS finalizada', 'corretiva', 'finalizado', null, null, '00000000-0000-0000-0000-000000002041'),
  -- D5: ponto de visita, mesmo aberto e com Chamado, não conta.
  ('00000000-0000-0000-0000-0000000020d6', '00000000-0000-0000-0000-0000000020aa', '00000000-0000-0000-0000-0000000020c7', 'OS-S204-6', 'INÍCIO VISITA ', 'corretiva', 'solicitacao', null, null, '00000000-0000-0000-0000-000000002041'),
  ('00000000-0000-0000-0000-0000000020d7', '00000000-0000-0000-0000-0000000020bb', '00000000-0000-0000-0000-0000000020c6', 'OS-S204-7', '[TESTE] OS do Cliente B', 'corretiva', 'solicitacao', null, null, '00000000-0000-0000-0000-000000002041');

-- Classificação (fonte única)
select is(pcm.fn_classificar_item_operacao('chamado_aberto', 'aberto', '00000000-0000-0000-0000-0000000020c4', null, null, null), 'chamado_aberto', 'classifica Chamado sem OS');
select is(pcm.fn_classificar_item_operacao('ordem_servico', 'cancelado', '00000000-0000-0000-0000-0000000020c4', null, null, null), 'historico', 'cancelada é histórico');
select is(pcm.fn_classificar_item_operacao('ordem_servico', 'solicitacao', null, null, null, null), 'pre_chamado', 'D1: OS sem Chamado é pré-chamado');
select is(pcm.fn_classificar_item_operacao('ordem_servico', 'solicitacao', '00000000-0000-0000-0000-0000000020c4', null, null, null), 'backlog', 'D3: sem data, técnico e tarefa é backlog');
select is(pcm.fn_classificar_item_operacao('ordem_servico', 'solicitacao', '00000000-0000-0000-0000-0000000020c4', null, null, 1), 'os_aberta', 'D3: com tarefa Auvo sai do backlog');
select is(pcm.fn_classificar_item_operacao('ordem_servico', 'validacao_pcm', '00000000-0000-0000-0000-0000000020c4', now(), null, null), 'os_aberta', 'D2: Validação PCM é aberta');

-- Parcelas do Cliente A
select results_eq(
  $$ select os_abertas, backlog, pre_chamados, chamados_abertos, demanda_em_aberto
     from pcm.fn_demanda_em_aberto(null, '00000000-0000-0000-0000-0000000020aa') $$,
  $$ values (3::bigint, 1::bigint, 1::bigint, 1::bigint, 5::bigint) $$,
  'Cliente A: 3 OS abertas (1 em backlog), 1 pré-chamado, 1 chamado aberto, demanda 5'
);
select is(
  (select demanda_em_aberto from pcm.fn_demanda_em_aberto(null, '00000000-0000-0000-0000-0000000020aa')),
  (select abertas from pcm.fn_kpis_operacao(null, '00000000-0000-0000-0000-0000000020aa')),
  'D4: demanda em aberto = "abertas" do KPI de Chamados (Cliente A)'
);
select is(
  (select os_abertas + pre_chamados + chamados_abertos from pcm.fn_demanda_em_aberto()),
  (select abertas from pcm.fn_kpis_operacao()),
  'D4: as três parcelas somam o KPI de Chamados (todos os Clientes)'
);
select is(
  (select demanda_em_aberto from pcm.fn_demanda_em_aberto('S204')),
  (select abertas from pcm.fn_kpis_operacao('S204')),
  'D4: parcelas e KPI aplicam a mesma busca'
);
select ok(
  (select backlog <= os_abertas from pcm.fn_demanda_em_aberto()),
  'D3: backlog é subconjunto de OS abertas'
);

-- Carteira = Visão 360 = Início
select results_eq(
  $$ select os_abertas, backlog, pre_chamados, chamados_abertos, demanda_em_aberto
     from pcm.fn_contagem_operacional_por_cliente('00000000-0000-0000-0000-0000000020aa') $$,
  $$ select os_abertas, backlog, pre_chamados, chamados_abertos, demanda_em_aberto
     from pcm.fn_demanda_em_aberto(null, '00000000-0000-0000-0000-0000000020aa') $$,
  'Visão 360 (por Cliente) = parcelas filtradas por Cliente'
);
select results_eq(
  $$ select os_abertas, backlog from pcm.fn_contagem_operacional_por_cliente()
     where cliente_id = '00000000-0000-0000-0000-0000000020aa' $$,
  $$ select os_abertas, backlog from pcm.fn_contagem_operacional_por_cliente('00000000-0000-0000-0000-0000000020aa') $$,
  'carteira (todos os Clientes) = Visão 360 para o Cliente A'
);
select results_eq(
  $$ select os_abertas, backlog from pcm.fn_contagem_operacional_por_cliente()
     where cliente_id = '00000000-0000-0000-0000-0000000020bb' $$,
  $$ values (1::bigint, 1::bigint) $$,
  'carteira: Cliente B tem 1 OS aberta, em backlog'
);
select is(
  (select sum(os_abertas)::bigint from pcm.fn_contagem_operacional_por_cliente()),
  (select os_abertas from pcm.fn_demanda_em_aberto()),
  'Início = soma da carteira'
);
select is(
  (select count(*) from pcm.fn_contagem_operacional_por_cliente() group by cliente_id having count(*) > 1 limit 1),
  null::bigint,
  'carteira: uma linha por Cliente'
);
select is(
  (select os_abertas from pcm.fn_contagem_operacional_por_cliente('00000000-0000-0000-0000-0000000020aa')),
  (select count(*) from pcm.ordens_servico
    where client_id = '00000000-0000-0000-0000-0000000020aa' and deleted_at is null
      and chamado_id is not null and status not in ('finalizado','cancelado')
      and pcm.normalizar_titulo_ponto_visita(titulo) not in ('inicio visita','fim visita')),
  'D1/D5: OS aberta = com Chamado, fora do histórico, sem ponto de visita'
);

-- Segurança
select ok(
  not (select prosecdef from pg_proc where oid = 'pcm.fn_demanda_em_aberto(text,uuid,uuid,text,date,date)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'pcm.fn_contagem_operacional_por_cliente(uuid)'::regprocedure),
  'contagens são security invoker (RLS do read model vale)'
);
select ok(
  not has_function_privilege('anon', 'pcm.fn_demanda_em_aberto(text,uuid,uuid,text,date,date)', 'execute')
  and not has_function_privilege('anon', 'pcm.fn_contagem_operacional_por_cliente(uuid)', 'execute'),
  'anon não executa as contagens'
);
select ok(
  has_function_privilege('authenticated', 'pcm.fn_demanda_em_aberto(text,uuid,uuid,text,date,date)', 'execute')
  and has_function_privilege('authenticated', 'pcm.fn_contagem_operacional_por_cliente(uuid)', 'execute'),
  'authenticated executa as contagens'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000002041","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select results_eq(
  $$ select os_abertas, demanda_em_aberto from pcm.fn_contagem_operacional_por_cliente('00000000-0000-0000-0000-0000000020aa') $$,
  $$ values (3::bigint, 5::bigint) $$,
  'permitido: pcm:leitura vê a contagem do Cliente'
);
select is(
  (select demanda_em_aberto from pcm.fn_demanda_em_aberto(null, '00000000-0000-0000-0000-0000000020aa')),
  5::bigint,
  'permitido: pcm:leitura vê as parcelas'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000002042","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*) from pcm.fn_contagem_operacional_por_cliente()),
  0::bigint,
  'negado: sem pcm, a carteira não devolve linhas'
);
select is(
  (select demanda_em_aberto from pcm.fn_demanda_em_aberto()),
  0::bigint,
  'negado: sem pcm, as parcelas são zero'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from pcm.fn_contagem_operacional_por_cliente() $$,
  '42501',
  null,
  'negado: anon recebe permission denied'
);
reset role;
select * from finish();
rollback;
