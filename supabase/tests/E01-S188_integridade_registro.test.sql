-- E01-S188 (AC-2) — o registro de jornadas não pode apontar para o vazio. Toda referência de
-- camada 'gate' tem que resolver para uma tabela real com coluna `habilitado`; toda referência de
-- 'grant' tem que resolver para uma função real. Um registro que cita gate/função inexistente é
-- pior do que não ter registro — ele mentiria no diagnóstico.
--
-- A camada 'flag' é verificada à parte por scripts/check-jornadas-flags.mjs, porque o código do
-- front não é visível de dentro do Postgres.
begin;
select plan(4);

select is(
  (select count(*)::int from config.sso_jornada_requisitos r
     where r.camada = 'gate' and pg_catalog.to_regclass(r.identificador) is null),
  0, 'todo gate citado no registro resolve para uma relação existente'
);

select is(
  (select count(*)::int from config.sso_jornada_requisitos r
     where r.camada = 'gate' and not exists (
       select 1 from information_schema.columns c
       where c.table_schema || '.' || c.table_name = r.identificador and c.column_name = 'habilitado'
     )),
  0, 'todo gate citado tem a coluna habilitado — senão o diagnóstico não tem o que ler'
);

select is(
  (select count(*)::int from config.sso_jornada_requisitos r
     where r.camada = 'grant' and pg_catalog.to_regprocedure(r.identificador) is null),
  0, 'toda função citada como grant resolve para uma função existente'
);

select is(
  (select count(*)::int from config.sso_jornada_requisitos r
     where r.papel = 'mecanismo' and r.camada <> 'gate'),
  0, 'requisito mecanismo só existe para gates (é o conceito de troca de proteção, não se aplica a flag/grant)'
);

select * from finish();
rollback;
