-- E01 (varredura transversal, migration 1839) — trava as invariantes do "terceiro pilar" de
-- ativação de feature (flag + gate + grant). Antes de 1839, 333 RPCs chamadas por componentes
-- vivos da UI não tinham execute para authenticated: abrir o gate em produção não bastaria,
-- a chamada morreria em 42501 "permission denied for function".
--
-- Este teste garante três coisas que não podem regredir:
--   1. as funções com gate concedidas em 1839 continuam alcançáveis por authenticated;
--   2. nenhum gate nasce aberto (o grant é inerte sem alguém abrir o gate de propósito);
--   3. conceder execute NÃO enfraqueceu autorização: usuário sem concessão continua recusado;
--   4. as 7 funções que escrevem SEM gate seguem deliberadamente sem grant.
begin;
select plan(13);

-- 1. Amostra representativa das 277 concedidas em 1839, de stories e schemas diferentes.
select ok(has_function_privilege('authenticated', 'pcm.sso_vincular_os_rotina(uuid,uuid,uuid,jsonb)', 'execute'),
  'S171: sso_vincular_os_rotina alcançável por authenticated');
select ok(has_function_privilege('authenticated', 'pcm.sso_vincular_pendencia_parcela(uuid,uuid,integer,bigint,bigint,uuid,uuid)', 'execute'),
  'S174: sso_vincular_pendencia_parcela alcançável por authenticated');
select ok(has_function_privilege('authenticated', 'pcm.sso_revogar_anexo_os(uuid,uuid,uuid,text)', 'execute'),
  'S183: sso_revogar_anexo_os alcançável por authenticated (consumida por PublicarAnexo.tsx)');

-- 2. Nenhum gate nasce aberto: o grant só vira comportamento quando alguém abrir um gate.
select is(
  (select count(*)::int from (
     select coalesce((xpath('/r/v/text()', query_to_xml(format('select bool_or(habilitado) as v from %I.%I', s, t), false, true, '')))[1]::text::bool, false) as aberto
     from (select c.table_schema s, c.table_name t from information_schema.columns c
           where c.column_name='habilitado' and c.table_name like '%gate%'
             and c.table_schema in ('pcm','financeiro','comercial','config','audit')) r
   ) z where aberto),
  0, 'nenhum gate do schema nasce aberto — 1839 é inerte até ativação deliberada'
);

-- 3. Conceder execute não enfraqueceu autorização: sem concessão, segue recusado e sem efeito.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18700000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's187-sem-concessao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values ('18700000-0000-4000-8000-000000000001', 'colaborador', 'S187 Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18700000-0000-4000-8000-000000000002', 'Cliente S187', true, '18700000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"18700000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_vincular_os_rotina(gen_random_uuid(),%L,gen_random_uuid(),'{}'::jsonb) $f$,
    '18700000-0000-4000-8000-000000000002'),
  '42501', null, 'usuário autenticado sem concessão continua recusado mesmo com execute concedido'
);
select throws_ok(
  format($f$ select pcm.sso_resumo_despesas_visita(%L,gen_random_uuid()) $f$, '18700000-0000-4000-8000-000000000002'),
  '42501', null, 'leitura concedida também exige autorização própria, nunca vaza por ter grant'
);

reset role;

-- 4. As 7 que escrevem SEM gate seguem sem grant: não há como ativá-las sem novo deploy.
select ok(not has_function_privilege('authenticated', p.oid, 'execute'), 'segue sem grant (escreve sem gate): ' || p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname || '.' || p.proname in (
  'comercial.sso_criar_orcamento_operacional', 'config.sso_criar_grupo_atomico',
  'config.sso_editar_grupo_idempotente', 'financeiro.sso_declarar_repasse_despesa',
  'financeiro.sso_publicar_cobranca_os', 'pcm.sso_alterar_previsao_visita',
  'pcm.sso_ratear_despesa_visita');

select * from finish();
rollback;
