-- E01-S190_modalidade_pmoc_plano_manutencao.test.sql — pgTAP (AC-2).
-- Migration 1855: coluna `modalidade` em pcm.planos_manutencao, aditiva, sem backfill.
-- Rodar com `supabase test db` (requer Docker/Supabase local).
begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-plano-s190@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-00000000e5c3', '[TESTE] Cliente Plano S190', '00000000-0000-0000-0000-00000000e502')
on conflict (id) do nothing;

-- 1) coluna nasce nullable — Plano sem modalidade (caso geral, maioria hoje) continua válido.
insert into pcm.planos_manutencao (id, cliente_id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-00000000e5c4', '00000000-0000-0000-0000-00000000e5c3', '[TESTE] Plano sem modalidade', '00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-00000000e502');
select is(
  (select modalidade from pcm.planos_manutencao where id = '00000000-0000-0000-0000-00000000e5c4'),
  null,
  'AC-2: Plano sem modalidade continua válido — coluna é aditiva, não obrigatória'
);

-- 2) aceita 'pmoc' — classificação explícita.
insert into pcm.planos_manutencao (id, cliente_id, nome, modalidade, created_by, updated_by)
values ('00000000-0000-0000-0000-00000000e5c5', '00000000-0000-0000-0000-00000000e5c3', '[TESTE] Plano PMOC', 'pmoc', '00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-00000000e502');
select is(
  (select modalidade from pcm.planos_manutencao where id = '00000000-0000-0000-0000-00000000e5c5'),
  'pmoc',
  'AC-2: Plano classificado como modalidade pmoc'
);

-- 3) rejeita qualquer valor fora do conjunto permitido (defesa em profundidade no banco).
select throws_ok(
  $$ insert into pcm.planos_manutencao (id, cliente_id, nome, modalidade, created_by, updated_by)
     values ('00000000-0000-0000-0000-00000000e5c6', '00000000-0000-0000-0000-00000000e5c3', '[TESTE] Plano inválido', 'invalida', '00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-00000000e502') $$,
  '23514',
  null,
  'modalidade rejeita valor fora de (null, pmoc)'
);

-- 4) sem backfill: Plano já existente antes da migration (simulado aqui como "criado agora, sem
--    modalidade") não vira pmoc sozinho — exige classificação explícita, nunca automática.
select is(
  (select count(*)::int from pcm.planos_manutencao
     where cliente_id = '00000000-0000-0000-0000-00000000e5c3' and modalidade = 'pmoc'),
  1,
  'AC-2: só o Plano explicitamente classificado é pmoc — nenhum backfill automático'
);

-- 5) update subsequente pra 'pmoc' funciona (reclassificação manual, caminho futuro de migração).
update pcm.planos_manutencao set modalidade = 'pmoc' where id = '00000000-0000-0000-0000-00000000e5c4';
select is(
  (select modalidade from pcm.planos_manutencao where id = '00000000-0000-0000-0000-00000000e5c4'),
  'pmoc',
  'AC-2: reclassificação explícita posterior é aceita'
);

delete from pcm.planos_manutencao where cliente_id = '00000000-0000-0000-0000-00000000e5c3';
delete from pcm.clientes where id = '00000000-0000-0000-0000-00000000e5c3';

select * from finish();
rollback;
