-- atendimento_fluxos_grafo.test.sql — pgTAP E02-S20.
begin;
select plan(4);
select has_table('atendimento', 'fluxo_recipes', 'recipes existem');
select has_table('atendimento', 'fluxo_logs', 'logs existem');
select ok((select count(*) > 0 from atendimento.fluxo_recipes), 'catalogo inicial possui recipe');
select lives_ok(
  $$ select definicao from atendimento.fluxos where jsonb_typeof(definicao) = 'array' limit 1 $$,
  'definicao linear de E02-S07 continua legivel'
);
select * from finish();
rollback;
