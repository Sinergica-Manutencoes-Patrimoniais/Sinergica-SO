-- pgTAP da migration 1908: abre só as duas travas do caminho de demanda (Fontes de Demanda).
-- Prova: abertas; esforço e obrigações preparadas seguem FECHADAS; RLS força; permitido e negado.
begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(10);

select is((select habilitado from pcm.capacidade_fontes_mediacao_gate where id), true, 'mediação de fontes aberta pela 1908');
select is((select habilitado from pcm.capacidade_demanda_gate where id), true, 'demanda aberta pela 1908');
select is((select habilitado from pcm.capacidade_esforco_declarado_gate where id), false, 'esforço declarado segue FECHADA');
select is((select habilitado from pcm.sso_fila_obrigacoes_preparadas_gate where id), false, 'obrigações preparadas (compartilhada com S166) segue FECHADA');
select is((select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='pcm' and c.relname in ('capacidade_fontes_mediacao_gate','capacidade_demanda_gate') and c.relrowsecurity and c.relforcerowsecurity),
  2::bigint, 'as duas travas seguem com RLS enable + force');
select ok(not has_table_privilege('authenticated','pcm.capacidade_demanda_gate','UPDATE'), 'usuário não edita a trava');

-- NEGADO: superadmin sem concessão capacidade.gerir não lê (superadmin não dispensa concessão)
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,50)$$,
  '42501','capacidade_nao_encontrada_ou_sem_acesso','sem concessão: negado (e não mais bloqueado por trava)');
reset role;

-- PERMITIDO: com concessão no Cliente
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002');
set local role authenticated;
select lives_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,50)$$, 'com concessão: lista sem erro');
-- NEGADO: Cliente sem concessão
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16895000-0000-4000-8000-000000000002','2026-10-26',null,50)$$,
  '42501','capacidade_nao_encontrada_ou_sem_acesso','outro Cliente sem concessão: negado');
reset role;
-- reverso documentado fecha de novo, com erro nomeado
update pcm.capacidade_demanda_gate set habilitado=false where id;
set local role authenticated;
select throws_ok($$select * from pcm.sso_fontes_demanda_autorizadas('16896000-0000-4000-8000-000000000002','2026-10-26',null,50)$$,
  '55000','demanda_capacidade_bloqueada','reverso da 1908 devolve a recusa nomeada');
reset role;
select * from finish();
rollback;
