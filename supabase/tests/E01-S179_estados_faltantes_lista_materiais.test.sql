-- E01-S179 (migration 1843, SSO-013) — os 7 estados da lista de materiais do §8.2 do Caderno.
--
-- Até a 1843 o `check` do banco só aceitava 4 estados; `aguardando_aquisicao`, `dispensada` e
-- `concluida` não tinham caminho nenhum. Este teste prova que os três existem, que se chega a
-- eles pelos eventos certos, e — mais importante — que as transições que NÃO deveriam existir
-- continuam recusadas. Um estado alcançável de qualquer lugar seria pior do que não existir.
--
-- As regras de transição foram derivadas do §8.1/§8.3 e estão documentadas no cabeçalho da
-- migration; este arquivo é onde elas viram contrato.
begin;
select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18430000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's179-estados@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18430000-0000-4000-8000-000000000001', 'superadmin', 'S179 Estados', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18430000-0000-4000-8000-00000000000a', 'Cliente S179 Estados', true, '18430000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18430000-0000-4000-8000-000000000001', 'material.gerir', '18430000-0000-4000-8000-00000000000a');
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18430000-0000-4000-8000-00000000001a', 'CH-S179-EST', '18430000-0000-4000-8000-00000000000a', 'Chamado dos materiais', '18430000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18430000-0000-4000-8000-00000000002a', '18430000-0000-4000-8000-00000000000a', '18430000-0000-4000-8000-00000000001a', 'X', 'OS dos materiais', 'corretiva', 'em_execucao', now(), '18430000-0000-4000-8000-000000000001');

-- Quatro listas, cada uma para percorrer um caminho diferente. Todas na mesma OS: lista de
-- materiais não é exclusiva por OS.
insert into pcm.listas_materiais (id, cliente_id, ordem_servico_id, responsavel, texto_original, criado_por) values
 ('18430000-0000-4000-8000-00000000003a', '18430000-0000-4000-8000-00000000000a', '18430000-0000-4000-8000-00000000002a', 'sinergica', 'Disjuntor 40A', '18430000-0000-4000-8000-000000000001'),
 ('18430000-0000-4000-8000-00000000003b', '18430000-0000-4000-8000-00000000000a', '18430000-0000-4000-8000-00000000002a', 'cliente',   'Cabo 2,5mm', '18430000-0000-4000-8000-000000000001'),
 ('18430000-0000-4000-8000-00000000003c', '18430000-0000-4000-8000-00000000000a', '18430000-0000-4000-8000-00000000002a', 'sinergica', 'Contator', '18430000-0000-4000-8000-000000000001'),
 ('18430000-0000-4000-8000-00000000003d', '18430000-0000-4000-8000-00000000000a', '18430000-0000-4000-8000-00000000002a', 'sinergica', 'Fusível', '18430000-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from pg_catalog.pg_constraint
    where conrelid = 'pcm.listas_materiais'::regclass and conname = 'listas_materiais_estado_check'
      and pg_catalog.pg_get_constraintdef(oid) like '%aguardando_aquisicao%'
      and pg_catalog.pg_get_constraintdef(oid) like '%dispensada%'
      and pg_catalog.pg_get_constraintdef(oid) like '%concluida%'),
  1, 'os 3 estados que faltavam passaram a ser aceitos pelo check do banco'
);

set local request.jwt.claims = '{"sub":"18430000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- O núcleo `sso_informar_material` é revogado de todos os papéis; quem a UI alcança é o mediador
-- `sso_informar_material_mediado` (1061), atrás do gate `sso_eventos_materiais_mediados_gate`.
-- Os estados novos nascem do lado certo dessa fronteira — fechados por padrão, como todo o resto.
select throws_ok(
  $$ select pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e0', '18430000-0000-4000-8000-00000000003a', 1,
       'aquisicao', '{}'::jsonb) $$,
  '55000', 'evento_material_bloqueado', 'gate de eventos de material fechado por padrão recusa tambem os estados novos'
);
reset role;
update pcm.sso_eventos_materiais_mediados_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18430000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── Caminho A: levantada -> aguardando_aquisicao -> parcial -> concluida ───────────────────
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e1', '18430000-0000-4000-8000-00000000003a', 1,
    'aquisicao', '{"observacao":"Compra autorizada pelo PCM"}'::jsonb)->>'state',
  'aguardando_aquisicao', 'lista sob responsabilidade da Sinérgica entra em aguardando_aquisicao'
);
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e1', '18430000-0000-4000-8000-00000000003a', 1,
    'aquisicao', '{"observacao":"Compra autorizada pelo PCM"}'::jsonb)->>'revision',
  '2', 'replay do mesmo requestId devolve a mesma revisão, não avança'
);
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e2', '18430000-0000-4000-8000-00000000003a', 2,
    'disponibilidade', '{"situacao":"parcial"}'::jsonb)->>'state',
  'parcial', 'material chega em parte: aguardando_aquisicao -> parcial'
);
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e3', '18430000-0000-4000-8000-00000000003a', 3,
    'conclusao', '{"observacao":"O que chegou atendeu a OS"}'::jsonb)->>'state',
  'concluida', 'parcial -> concluida: concluir exige que algum material tenha chegado'
);
-- Concluída é terminal de verdade: nem pelo comando, nem por qualquer outro escritor.
select throws_ok(
  $$ select pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e4', '18430000-0000-4000-8000-00000000003a', 4,
       'disponibilidade', '{"situacao":"indisponivel"}'::jsonb) $$,
  '23514', 'lista_materiais_concluida', 'lista concluída não aceita novo evento'
);
-- Como dono da tabela, sem passar por grant nenhum: é a trigger que barra, não o privilégio.
reset role;
select throws_ok(
  $$ update pcm.listas_materiais set revisao = revisao + 1 where id = '18430000-0000-4000-8000-00000000003a' $$,
  '23514', 'lista_materiais_concluida', 'a trigger barra QUALQUER escritor numa lista concluída, não só o comando'
);
set local request.jwt.claims = '{"sub":"18430000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── Caminho B: responsável Cliente não gera aquisição pela Sinérgica (§8.3) ────────────────
select throws_ok(
  $$ select pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e5', '18430000-0000-4000-8000-00000000003b', 1,
       'aquisicao', '{}'::jsonb) $$,
  '23514', 'aquisicao_exige_responsavel_sinergica',
  'lista sob responsabilidade do Cliente não entra em aguardando_aquisicao'
);

-- ── Caminho C: dispensa com motivo, e a única volta possível ──────────────────────────────
select throws_ok(
  $$ select pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e6', '18430000-0000-4000-8000-00000000003c', 1,
       'dispensa', '{}'::jsonb) $$,
  '22023', 'dispensa_invalida', 'dispensar sem motivo é recusado: decisão sem motivo não é auditável'
);
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e7', '18430000-0000-4000-8000-00000000003c', 1,
    'dispensa', '{"motivo":"Cliente retirou o item do escopo"}'::jsonb)->>'state',
  'dispensada', 'dispensa com motivo leva a lista a dispensada'
);
select throws_ok(
  $$ select pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e8', '18430000-0000-4000-8000-00000000003c', 2,
       'disponibilidade', '{"situacao":"informada_disponivel"}'::jsonb) $$,
  '23514', 'lista_materiais_dispensada', 'lista dispensada não volta por disponibilidade'
);
select throws_ok(
  $$ select pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000e9', '18430000-0000-4000-8000-00000000003c', 2,
       'excecao', '{"motivo":"faltante","descricao":"Sumiu"}'::jsonb) $$,
  '23514', 'lista_materiais_dispensada', 'exceção comum também não reabre uma lista dispensada'
);
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000ea', '18430000-0000-4000-8000-00000000003c', 2,
    'excecao', '{"motivo":"novo_levantamento","descricao":"Escopo voltou; refazer o levantamento"}'::jsonb)->>'state',
  'levantada', 'novo levantamento é a única saída da dispensa, e volta a lista para levantada'
);

-- ── Caminho D: concluir exige material; de indisponível não se conclui ─────────────────────
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000eb', '18430000-0000-4000-8000-00000000003d', 1,
    'disponibilidade', '{"situacao":"indisponivel"}'::jsonb)->>'state',
  'indisponivel', 'disponibilidade indisponível continua funcionando como antes'
);
select throws_ok(
  $$ select pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000ec', '18430000-0000-4000-8000-00000000003d', 2,
       'conclusao', '{}'::jsonb) $$,
  '23514', 'transicao_de_estado_invalida', 'de indisponível não se conclui: dispensa-se ou refaz-se'
);
select is(
  pcm.sso_informar_material_mediado('18430000-0000-4000-8000-0000000000ed', '18430000-0000-4000-8000-00000000003d', 2,
    'aquisicao', '{}'::jsonb)->>'state',
  'aguardando_aquisicao', 'faltou material: indisponivel -> aguardando_aquisicao é caminho válido'
);

-- A trilha de eventos é append-only e registra o tipo novo — sem isso não há como auditar
-- quem dispensou o quê.
reset role;
select is(
  (select tipo from pcm.sso_lista_materiais_eventos
     where lista_id = '18430000-0000-4000-8000-00000000003c' and revisao = 2),
  'dispensa', 'o evento de dispensa fica registrado na trilha com o tipo próprio'
);
select is(
  (select dados->>'motivo' from pcm.sso_lista_materiais_eventos
     where lista_id = '18430000-0000-4000-8000-00000000003c' and revisao = 2),
  'Cliente retirou o item do escopo', 'o motivo da dispensa fica auditável na trilha'
);

select * from finish();
rollback;
