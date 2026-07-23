-- pcm_chamados_rls.test.sql — pgTAP (E01-S88 AC-1/AC-3/AC-4)
-- Numeração atômica via sequence (AC-1), vínculo Chamado→OS (AC-3), append-only de eventos (AC-4),
-- RLS por módulo pcm (leitura vs escrita).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-escrita-s88@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000b02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'colaborador-s88@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-000000000bc1', '[TESTE] Cliente S88', '00000000-0000-0000-0000-000000000b01')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000b01","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- 1) AC-1: numeração via sequence — dois fn_proximo_numero_chamado() seguidos nunca colidem
select isnt(
  pcm.fn_proximo_numero_chamado(),
  pcm.fn_proximo_numero_chamado(),
  'AC-1: fn_proximo_numero_chamado nunca repete (sequence atomica)'
);

-- 2) cadastro direto: cria Chamado com status aberto e origem manual por default
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by)
values ('00000000-0000-0000-0000-000000000bc2', pcm.fn_proximo_numero_chamado(), '00000000-0000-0000-0000-000000000bc1', '[TESTE E2E] Vazamento', '00000000-0000-0000-0000-000000000b01');
select is(
  (select status from pcm.chamados where id = '00000000-0000-0000-0000-000000000bc2'),
  'aberto',
  'AC-2: Chamado nasce com status aberto'
);
select is(
  (select origem from pcm.chamados where id = '00000000-0000-0000-0000-000000000bc2'),
  'manual',
  'origem default manual'
);

-- 3) AC-4: cancelamento sem justificativa é bloqueado pela constraint? Não há CHECK de not-null
--    condicional no banco (a validação é no domínio TS) — aqui confirmamos que o campo aceita
--    gravar a justificativa quando presente (contrato de dado, não de UX).
update pcm.chamados set status = 'cancelado', cancelamento_justificativa = 'Cliente desistiu'
  where id = '00000000-0000-0000-0000-000000000bc2';
select is(
  (select cancelamento_justificativa from pcm.chamados where id = '00000000-0000-0000-0000-000000000bc2'),
  'Cliente desistiu',
  'AC-4: justificativa de cancelamento persiste'
);

-- 4) AC-4: chamados_eventos é insert-only — usuário comum consegue inserir evento próprio
insert into pcm.chamados_eventos (chamado_id, tipo, metadata)
values ('00000000-0000-0000-0000-000000000bc2', 'cancelado', '{"justificativa":"Cliente desistiu"}'::jsonb);
select is(
  (select count(*) from pcm.chamados_eventos where chamado_id = '00000000-0000-0000-0000-000000000bc2'),
  1::bigint,
  'AC-4: evento de cancelamento gravado (append-only)'
);

-- 5) AC-4: chamados_eventos NÃO tem policy de update/delete — tentar apagar falha por RLS
select throws_ok(
  $$ delete from pcm.chamados_eventos where chamado_id = '00000000-0000-0000-0000-000000000bc2' $$,
  '42501',
  null,
  'AC-4: ninguem apaga evento de auditoria (sem policy de delete pra authenticated)'
);

-- 6) AC-3: vínculo chamado_id em ordens_servico — cria uma OS ligada ao Chamado
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, prioridade, gravidade, urgencia, tendencia, origem, created_by, chamado_id)
values ('00000000-0000-0000-0000-000000000bc3', '00000000-0000-0000-0000-000000000bc1', pcm.fn_proximo_numero_os(), '[TESTE E2E] OS do Chamado', 'corretiva', 'solicitacao', 'media', 3, 3, 3, 'manual', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000bc2');
select is(
  (select chamado_id from pcm.ordens_servico where id = '00000000-0000-0000-0000-000000000bc3'),
  '00000000-0000-0000-0000-000000000bc2'::uuid,
  'AC-3: OS grava o vinculo chamado_id'
);

-- 7) FK rejeita chamado_id inexistente (defesa em profundidade)
select throws_ok(
  $$ update pcm.ordens_servico set chamado_id = '00000000-0000-0000-0000-00000000dead' where id = '00000000-0000-0000-0000-000000000bc3' $$,
  '23503',
  null,
  'FK ordens_servico_chamado_id_fkey rejeita chamado inexistente'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000b02","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

-- 8) leitura: usuário só-leitura enxerga o Chamado
select is(
  (select count(*) from pcm.chamados where id = '00000000-0000-0000-0000-000000000bc2'),
  1::bigint,
  'usuario so-leitura enxerga o Chamado (policy select por modulo pcm)'
);

-- 9) escrita: usuário só-leitura NÃO consegue criar Chamado
select throws_ok(
  $$ insert into pcm.chamados (cliente_id, titulo, created_by) values ('00000000-0000-0000-0000-000000000bc1', 'x', '00000000-0000-0000-0000-000000000b02') $$,
  '42501',
  null,
  'usuario so-leitura NAO cria Chamado (RLS insert exige pcm:escrita)'
);

reset role;
select * from finish();
rollback;
