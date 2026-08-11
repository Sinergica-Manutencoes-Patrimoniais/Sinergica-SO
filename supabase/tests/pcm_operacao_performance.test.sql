-- pcm_operacao_performance.test.sql — pgTAP E01-S145
begin;
select plan(17);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000001451', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-s145-write@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000001452', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-s145-read@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000001453', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-s145-none@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-00000000145a', '[TESTE] Cliente S145', '00000000-0000-0000-0000-000000001451')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000001451","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

insert into pcm.chamados (id, numero, cliente_id, titulo, status, created_by)
values
  ('00000000-0000-0000-0000-00000000145b', 'CH-S145-1', '00000000-0000-0000-0000-00000000145a', '[TESTE] Chamado aberto S145', 'aberto', '00000000-0000-0000-0000-000000001451'),
  ('00000000-0000-0000-0000-00000000145c', 'CH-S145-2', '00000000-0000-0000-0000-00000000145a', '[TESTE] Chamado convertido S145', 'convertido_os', '00000000-0000-0000-0000-000000001451');

insert into pcm.ordens_servico (
  id, client_id, chamado_id, numero, titulo, categoria, status, prioridade,
  gravidade, urgencia, tendencia, origem, created_by
) values
  ('00000000-0000-0000-0000-00000000145d', '00000000-0000-0000-0000-00000000145a', '00000000-0000-0000-0000-00000000145c', 'DESCARTADO-S145', '[TESTE] OS ativa S145', 'corretiva', 'solicitacao', 'critica', 3, 3, 3, 'manual', '00000000-0000-0000-0000-000000001451'),
  ('00000000-0000-0000-0000-00000000145e', '00000000-0000-0000-0000-00000000145a', null, 'VISITA-S145', 'INICIO VISITA', 'corretiva', 'finalizado', 'normal', 1, 1, 1, 'auvo_sync', '00000000-0000-0000-0000-000000001451'),
  ('00000000-0000-0000-0000-00000000145f', '00000000-0000-0000-0000-00000000145a', null, 'FINAL-S145', '[TESTE] OS finalizada S145', 'corretiva', 'finalizado', 'normal', 1, 1, 1, 'manual', '00000000-0000-0000-0000-000000001451');

select ok(
  (select reloptions @> array['security_invoker=on'] from pg_class where oid = 'pcm.operacao_itens'::regclass),
  'AC-8: view usa security_invoker'
);
select is(
  (select count(*) from pcm.operacao_itens where item_id = 'chamado-aberto:00000000-0000-0000-0000-00000000145b' and item_tipo = 'chamado_aberto'),
  1::bigint,
  'AC-3: Chamado aberto sem OS aparece uma vez'
);
select is(
  (select count(*) from pcm.operacao_itens where chamado_id = '00000000-0000-0000-0000-00000000145c' and item_tipo = 'ordem_servico'),
  1::bigint,
  'AC-3: Chamado convertido aparece somente como OS'
);
select is(
  (select count(*) from pcm.operacao_itens where titulo = 'INICIO VISITA'),
  0::bigint,
  'AC-6: registro de visita não entra no read model'
);
select is(
  (select count(*) from pcm.operacao_itens where cliente_id = '00000000-0000-0000-0000-00000000145a' and status not in ('finalizado','cancelado')),
  2::bigint,
  'AC-1: pseudofiltro ativos inclui Chamado aberto e OS ativa'
);
select is(
  (select total from pcm.fn_kpis_operacao(null, '00000000-0000-0000-0000-00000000145a', null, null, null, null)),
  3::bigint,
  'AC-3: KPI total inclui ativos e histórico, sem registro de visita'
);
select is(
  (select criticas from pcm.fn_kpis_operacao('OS ativa', '00000000-0000-0000-0000-00000000145a', null, null, null, null)),
  1::bigint,
  'AC-4: KPI respeita busca server-side'
);
select is(
  (select count(*) from pcm.operacao_itens where categoria = 'corretiva' and created_at::date = current_date),
  3::bigint,
  'AC-2: read model filtra categoria e intervalo de data'
);
select is(
  (select item_id from pcm.operacao_itens order by score_pcm desc, created_at desc, item_id asc limit 1),
  '00000000-0000-0000-0000-00000000145d',
  'AC-2: ordenação GUTD prioriza maior score com desempate estável'
);
select ok(
  (
    with dados(created_at, id) as (
      values
        ('2026-08-10T12:00:00Z'::timestamptz, 'a'::text),
        ('2026-08-10T12:00:00Z'::timestamptz, 'b'::text)
    ), primeira as (
      select * from dados order by created_at desc, id asc limit 1
    ), continuacao as (
      select d.* from dados d, primeira p
       where d.created_at < p.created_at
          or (d.created_at = p.created_at and d.id > p.id)
       order by d.created_at desc, d.id asc
    ), paginas as (
      select * from primeira union all select * from continuacao
    )
    select count(*) = 2 and count(distinct id) = 2 from paginas
  ),
  'AC-2: cursor com timestamp empatado não duplica nem omite item'
);

set local enable_seqscan = off;
create temp table s145_explain (plano jsonb) on commit drop;
do $$
declare
  v_plano json;
begin
  execute $query$
    explain (analyze, buffers, format json)
    select id, created_at
      from pcm.ordens_servico
     where deleted_at is null
       and status not in ('finalizado', 'cancelado')
     order by created_at desc, id asc
     limit 50
  $query$ into v_plano;
  insert into s145_explain values (v_plano::jsonb);
end;
$$;
select ok(
  (select plano::text like '%idx_os_operacao_ativos_created%' from s145_explain),
  'AC-9: consulta crítica possui Index Scan no plano'
);
select ok(
  (select (plano #>> '{0,Execution Time}')::numeric < 100 from s145_explain),
  'AC-9: consulta crítica executa abaixo de 100 ms'
);
set local enable_seqscan = on;

select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['00000000-0000-0000-0000-00000000145d'::uuid], 'planejamento')),
  true,
  'AC-7: lote atualiza OS autorizada'
);
select is(
  (select status from pcm.ordens_servico where id = '00000000-0000-0000-0000-00000000145d'),
  'planejamento',
  'AC-7: status do lote persiste'
);
select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['00000000-0000-0000-0000-000000001450'::uuid], 'planejamento')),
  false,
  'AC-7: lote reporta item inexistente sem falhar o round-trip'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000001452","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
select is(
  (select count(*) from pcm.operacao_itens where cliente_id = '00000000-0000-0000-0000-00000000145a'),
  3::bigint,
  'AC-8: usuário pcm:leitura consulta o read model'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000001453","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*) from pcm.operacao_itens where cliente_id = '00000000-0000-0000-0000-00000000145a'),
  0::bigint,
  'AC-8: usuário sem pcm não recebe linhas'
);

reset role;
select * from finish();
rollback;
