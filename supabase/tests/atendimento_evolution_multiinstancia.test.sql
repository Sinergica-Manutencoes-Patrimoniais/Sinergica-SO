-- atendimento_evolution_multiinstancia.test.sql — pgTAP (E02-S22, AC-1..AC-9)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(24);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-multi-write@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000003a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atd-multi-read@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by) values
  ('3a000000-0000-0000-0000-000000000001', 'Cliente Alfa', '00000000-0000-0000-0000-0000000003a1'),
  ('3a000000-0000-0000-0000-000000000002', 'Cliente Beta', '00000000-0000-0000-0000-0000000003a1');

insert into atendimento.canais_externos (id, tipo, label, identificador_externo, created_by) values
  ('3a000000-0000-0000-0000-000000000011', 'evolution', 'Chamados A', 'evo-chamados-a', '00000000-0000-0000-0000-0000000003a1'),
  ('3a000000-0000-0000-0000-000000000012', 'evolution', 'Comercial B', 'evo-comercial-b', '00000000-0000-0000-0000-0000000003a1');

insert into atendimento.personas (id, nome, tipo, prompt_sistema, base_conhecimento, created_by) values
  ('3a000000-0000-0000-0000-000000000021', 'Persona Chamados A', 'chamados', 'prompt A', 'base A', '00000000-0000-0000-0000-0000000003a1'),
  ('3a000000-0000-0000-0000-000000000022', 'Persona Comercial B', 'comercial', 'prompt B', 'base B', '00000000-0000-0000-0000-0000000003a1');

insert into atendimento.conversas (id, instance_id, remote_jid, contato_nome) values
  ('3a000000-0000-0000-0000-000000000031', 'evo-chamados-a', '5511999990001@s.whatsapp.net', 'Contato A');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';

select throws_ok(
  $$ insert into atendimento.instancias_agente (instance_id, persona_id, created_by) values ('evo-inexistente', '3a000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000003a1') $$,
  '23503', null,
  'mapeamento rejeita instancia Evolution inexistente'
);
select lives_ok(
  $$ insert into atendimento.instancias_agente (instance_id, persona_id, created_by) values ('evo-chamados-a', '3a000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-0000000003a1') $$,
  'instancia A vincula persona de chamados'
);
select lives_ok(
  $$ insert into atendimento.instancias_agente (instance_id, persona_id, created_by) values ('evo-comercial-b', '3a000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-0000000003a1') $$,
  'instancia B vincula persona comercial'
);
select is(
  (select count(distinct persona_id)::int from atendimento.instancias_agente where instance_id in ('evo-chamados-a', 'evo-comercial-b')),
  2,
  'duas instancias mantem agentes independentes'
);
select is(
  (select count(*)::int from atendimento.fn_listar_clientes_para_vinculo()),
  2,
  'atendente com escrita lista clientes ativos para vinculo'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003a2","role":"authenticated","user_role":"colaborador","user_modulos":{"atendimento":"leitura"}}';
select throws_ok(
  $$ select * from atendimento.fn_listar_clientes_para_vinculo() $$,
  '42501', null,
  'leitura nao lista CRM para alteracao'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003a2","role":"authenticated"}';
select throws_ok(
  $$ select * from atendimento.fn_listar_clientes_para_vinculo() $$,
  '42501', null,
  'authenticated sem user_modulos nao lista CRM'
);
select throws_ok(
  $$ select atendimento.fn_vincular_conversa_cliente('3a000000-0000-0000-0000-000000000031', '3a000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'authenticated sem user_modulos nao vincula conversa ao CRM'
);
select throws_ok(
  $$ select atendimento.fn_definir_handoff('3a000000-0000-0000-0000-000000000031', 'assumir', null) $$,
  '42501', null,
  'authenticated sem user_modulos nao assume conversa'
);
select throws_ok(
  $$ select atendimento.fn_debounce_wa_queue('teste:negado', now() + interval '3 seconds') $$,
  '42501', null,
  'authenticated nao executa debounce exclusivo do service_role'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ select atendimento.fn_vincular_conversa_cliente('3a000000-0000-0000-0000-000000000031', '3a000000-0000-0000-0000-000000000001') $$,
  'atendente vincula conversa ao cliente PCM'
);
select is(
  (select client_id from atendimento.conversas where id = '3a000000-0000-0000-0000-000000000031'),
  '3a000000-0000-0000-0000-000000000001'::uuid,
  'conversa guarda cliente vinculado'
);
select is(
  (select count(*)::int from relacionamento.vinculos where entidade_tipo = 'pcm_cliente' and entidade_id = '3a000000-0000-0000-0000-000000000001' and principal),
  1,
  'relacionamento CRM principal e criado'
);
select is(
  (select count(*)::int from atendimento.conversa_cliente_eventos where conversa_id = '3a000000-0000-0000-0000-000000000031'),
  1,
  'vinculo CRM gera evento auditavel'
);
reset role;

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select lives_ok(
  $$ select atendimento.fn_definir_handoff('3a000000-0000-0000-0000-000000000031', 'automatico', 'Cliente pediu humano') $$,
  'runtime realiza handoff automatico'
);
select is(
  (select modo || ':' || status from atendimento.conversas where id = '3a000000-0000-0000-0000-000000000031'),
  'pausado:pendente',
  'handoff automatico pausa IA e deixa pendente'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';
select lives_ok(
  $$ select atendimento.fn_definir_handoff('3a000000-0000-0000-0000-000000000031', 'assumir', null) $$,
  'atendente assume conversa'
);
select is(
  (select atribuido_a from atendimento.conversas where id = '3a000000-0000-0000-0000-000000000031'),
  '00000000-0000-0000-0000-0000000003a1'::uuid,
  'handoff registra atendente responsavel'
);
select lives_ok(
  $$ select atendimento.fn_definir_handoff('3a000000-0000-0000-0000-000000000031', 'devolver', null) $$,
  'atendente devolve conversa a IA'
);
select is(
  (select modo || ':' || status || ':' || coalesce(atribuido_a::text, 'null') from atendimento.conversas where id = '3a000000-0000-0000-0000-000000000031'),
  'auto:aberta:null',
  'devolucao reativa IA e limpa atribuicao'
);
reset role;

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select ok(
  atendimento.fn_consumir_rate_limit_webhook('teste:evo-a', 1, 60),
  'primeira entrega passa no rate limit'
);
select ok(
  not atendimento.fn_consumir_rate_limit_webhook('teste:evo-a', 1, 60),
  'entrega excedente e bloqueada'
);

create temporary table debounce_resultados (id uuid);
insert into debounce_resultados values
  (atendimento.fn_debounce_wa_queue('teste:debounce-atomico', now() + interval '3 seconds')),
  (atendimento.fn_debounce_wa_queue('teste:debounce-atomico', now() + interval '6 seconds'));
select is(
  (select count(distinct id)::int from debounce_resultados),
  1,
  'duas chamadas de debounce retornam a mesma fila pending'
);
select is(
  (select count(*)::int from atendimento.wa_queue where queue_key = 'teste:debounce-atomico' and status = 'pending'),
  1,
  'duas chamadas de debounce nao criam duas filas pending'
);
reset role;

select * from finish();
rollback;
