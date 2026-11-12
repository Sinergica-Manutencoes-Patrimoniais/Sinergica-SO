-- E01-S167 (migration 1842) — trava os invariantes do corte 1:1 -> 1:N entre Chamado e OS.
--
-- O corte estava escrito desde S167 como script MANUAL
-- (`docs/planejamento/plano-manutencao/operacao/s167-transicao-1n.sql`) e por isso nunca rodou:
-- toda a engenharia de 1:N existia e recusava com `55000 transicao_legada_incompleta` porque o
-- índice legado `pcm.uq_ordens_servico_chamado` seguia no schema. A 1842 virou migration. Este
-- teste existe pra que o estado resultante não possa regredir em silêncio.
--
-- Dois invariantes merecem destaque, porque são contraintuitivos:
--   1. `pcm.sso_guarda_multiplas_os_gate` tem que estar ABERTO. Ele não é ativação de feature, é
--      a chave do mecanismo de proteção: enquanto o índice existia, era o índice que impedia a 2ª
--      OS; com o índice fora, só a guarda (1499) faz esse papel, e só quando o gate está aberto.
--      Gate fechado + índice ausente é o estado INSEGURO — tanto que a própria guarda levanta
--      `guarda_multiplas_os_desabilitada` nesse caso.
--   2. `pcm.chamado_os_gate` tem que continuar FECHADO. O corte removeu o bloqueio ESTRUTURAL;
--      liberar várias OS pela UI segue sendo decisão operacional separada.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(10);

-- Estado do schema depois do corte.
select is(
  (select pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado')::text), null::text,
  'índice legado uq_ordens_servico_chamado não existe mais'
);
select hasnt_trigger('pcm', 'ordens_servico', 'trg_ordens_servico_numero_chamado',
  'trigger legada de numeração foi removida');
select has_trigger('pcm', 'ordens_servico', 'sso_numero_os_chamado',
  'trigger de numeração compatível assumiu o lugar da legada');
select is(
  (select t.tgfoid::regprocedure::text from pg_catalog.pg_trigger t
     where t.tgrelid = 'pcm.ordens_servico'::regclass and t.tgname = 'sso_numero_os_chamado'),
  'pcm.sso_numero_os_chamado_compativel()',
  'a numeração nova é a função preparada em 1500, não outra'
);
select has_trigger('pcm', 'ordens_servico', 'sso_guardar_novo_vinculo_chamado_os',
  'guarda de novo vínculo segue instalada');
select is(
  (select habilitado from pcm.sso_guarda_multiplas_os_gate where id), true,
  'gate da guarda ABERTO: sem o índice, é a guarda que impede a 2ª OS indevida'
);
select is(
  (select habilitado from pcm.chamado_os_gate where id), false,
  'gate de feature segue FECHADO: o corte é estrutural, não libera múltiplas OS na UI'
);

-- Comportamento real de escrita, com o schema já cortado.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18420000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's167-transicao-1n@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18420000-0000-4000-8000-000000000001', 'superadmin', 'S167 Transição 1:N', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18420000-0000-4000-8000-00000000000a', 'Cliente S167 Transição', true, '18420000-0000-4000-8000-000000000001');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18420000-0000-4000-8000-00000000001a', 'CH-S167-TRANS', '18420000-0000-4000-8000-00000000000a', 'Chamado da transição', '18420000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"18420000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

-- 1ª OS do Chamado: caminho normal, sem token. A numeração tem que sair igual à da trigger legada
-- (o número do próprio Chamado) — é o que garante que o corte não mexeu no fluxo de 1 OS.
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18420000-0000-4000-8000-00000000002a', '18420000-0000-4000-8000-00000000000a', '18420000-0000-4000-8000-00000000001a', 'SERA-SOBRESCRITO', 'Primeira OS', 'corretiva', 'solicitacao', now(), '18420000-0000-4000-8000-000000000001');
select is(
  (select numero from pcm.ordens_servico where id = '18420000-0000-4000-8000-00000000002a'),
  'CH-S167-TRANS',
  '1ª OS do Chamado recebe o número do Chamado, igual à numeração legada'
);

-- 2ª OS sem token de comando: antes batia em `23505` (violação do índice único); agora a recusa
-- vem da guarda, com erro nomeado. Mesma proteção, mecanismo diferente.
select throws_ok(
  $$ insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
     ('18420000-0000-4000-8000-00000000002b', '18420000-0000-4000-8000-00000000000a', '18420000-0000-4000-8000-00000000001a', 'X', 'Segunda OS sem comando', 'corretiva', 'solicitacao', now(), '18420000-0000-4000-8000-000000000001') $$,
  '23514', 'novo_vinculo_exige_comando_chamado_os',
  '2ª OS sem token de comando segue recusada, agora pela guarda e não pelo índice'
);

-- 2ª OS com o token que `pcm.sso_criar_os_chamado` emite: passa, e só aí a numeração diverge do
-- número do Chamado, ganhando o sufixo que torna 1:N possível sem colidir.
insert into pcm.sso_guarda_multiplas_os_tokens (txid, ator_id, chamado_id, cliente_id, os_id) values
 (pg_catalog.txid_current(), '18420000-0000-4000-8000-000000000001', '18420000-0000-4000-8000-00000000001a', '18420000-0000-4000-8000-00000000000a', '18420000-0000-4000-8000-00000000002c');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18420000-0000-4000-8000-00000000002c', '18420000-0000-4000-8000-00000000000a', '18420000-0000-4000-8000-00000000001a', 'X', 'Segunda OS com comando', 'corretiva', 'solicitacao', now(), '18420000-0000-4000-8000-000000000001');
select is(
  (select numero from pcm.ordens_servico where id = '18420000-0000-4000-8000-00000000002c'),
  'CH-S167-TRANS-OS-18420000-0000-4000-8000-00000000002c',
  '2ª OS criada por comando recebe <numero-do-chamado>-OS-<id>, sem colidir com a 1ª'
);

select * from finish();
rollback;
