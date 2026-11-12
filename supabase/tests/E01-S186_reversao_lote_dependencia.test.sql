-- E01-S186 US1 / SSO-021 (AC-3, segunda metade) — "rollback lógico identifica dependência
-- posterior e mantém pendência de reconciliação em vez de apagar execução/financeiro".
--
-- Par de `E01-S186_lote_migracao_reexecutavel.test.sql`. Lá o risco é duplicar ao repetir; aqui o
-- risco é o oposto e pior: desfazer uma migração e, no caminho, apagar algo que a operação já
-- produziu em cima dela. Num piloto real isso é o acidente irreversível — por isso a reversão não
-- pode ser "delete em cascata" e precisa saber parar.
--
-- Dois planos, mesmo lote, destinos diferentes de propósito:
--   • plano A está limpo         -> reversão lógica acontece;
--   • plano B ganhou uma decisão de vencimento depois de migrado (uma dependência real, com FK
--     para a rotina migrada) -> a reversão NÃO apaga; devolve `pendente_reconciliacao`.
-- A varredura que decide isso é genérica: percorre toda coluna com FK apontando para o plano, a
-- versão ou a rotina. Não é uma lista de tabelas que alguém precisa lembrar de atualizar.
begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18610000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's186-reversao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18610000-0000-4000-8000-000000000001', 'superadmin', 'S186 Reversão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18610000-0000-4000-8000-00000000000a', 'Cliente S186 Reversão', true, '18610000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18610000-0000-4000-8000-000000000001', 'plano.gerir', '18610000-0000-4000-8000-00000000000a');
insert into pcm.sistemas (id, cliente_id, nome, created_by) values
 ('18610000-0000-4000-8000-00000000001a', '18610000-0000-4000-8000-00000000000a', 'Sistema A', '18610000-0000-4000-8000-000000000001'),
 ('18610000-0000-4000-8000-00000000001b', '18610000-0000-4000-8000-00000000000a', 'Sistema B', '18610000-0000-4000-8000-000000000001');
insert into pcm.questionarios (id, auvo_id, nome) values
 ('18610000-0000-4000-8000-00000000002a', 918610, 'Checklist legado');
insert into pcm.tipos_tarefa (id, nome) values
 ('18610000-0000-4000-8000-00000000003a', 'Preventiva legada');
insert into pcm.planos_preventivos (id, cliente_id, sistema_id, questionario_id, tipo_tarefa_id, nome, primeira_data, intervalo_unidade, intervalo_n, created_by) values
 ('18610000-0000-4000-8000-00000000004a', '18610000-0000-4000-8000-00000000000a', '18610000-0000-4000-8000-00000000001a', '18610000-0000-4000-8000-00000000002a', '18610000-0000-4000-8000-00000000003a', 'Plano A limpo', date '2026-01-10', 'meses', 6, '18610000-0000-4000-8000-000000000001'),
 ('18610000-0000-4000-8000-00000000004b', '18610000-0000-4000-8000-00000000000a', '18610000-0000-4000-8000-00000000001b', '18610000-0000-4000-8000-00000000002a', '18610000-0000-4000-8000-00000000003a', 'Plano B com dependência', date '2026-02-20', 'meses', 3, '18610000-0000-4000-8000-000000000001');

update pcm.sso_aceite_lote_legado_gate set habilitado = true where id;
update pcm.sso_lote_rascunhos_legados_gate set habilitado = true where id;
update pcm.sso_rascunho_plano_legado_gate set habilitado = true where id;
update pcm.migracao_preflight_gate set habilitado = true where id;

select jsonb_build_array(
  jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000e1','planoId','18610000-0000-4000-8000-00000000004a',
    'rotinaId','18610000-0000-4000-8000-0000000000f1','fotografia',(select to_jsonb(p) from pcm.planos_preventivos p where p.id='18610000-0000-4000-8000-00000000004a'),
    'modo','calendario','intervalo','6','unidade','meses','dataBase','2026-01-10','antes','5','depois','5'),
  jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000e2','planoId','18610000-0000-4000-8000-00000000004b',
    'rotinaId','18610000-0000-4000-8000-0000000000f2','fotografia',(select to_jsonb(p) from pcm.planos_preventivos p where p.id='18610000-0000-4000-8000-00000000004b'),
    'modo','calendario','intervalo','3','unidade','meses','dataBase','2026-02-20','antes','5','depois','5')
)::text as itens \gset

set local request.jwt.claims = '{"sub":"18610000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

select (pcm.sso_aceitar_previa_lote_legado('18610000-0000-4000-8000-000000000001', '18610000-0000-4000-8000-00000000000a',
  '18610000-0000-4000-8000-0000000000d1', :'itens'::jsonb, true)) as aceite \gset
select (pcm.sso_criar_lote_legado_aceito('18610000-0000-4000-8000-000000000001', '18610000-0000-4000-8000-00000000000a',
  '18610000-0000-4000-8000-0000000000d2', '18610000-0000-4000-8000-0000000000d1')) as lote \gset
select is(:'lote'::jsonb->>'quantidade', '2', 'os 2 planos legados foram migrados para rascunho');

-- A revisão corrente do plano migrado é a que a reversão exige (controle otimista); lida do
-- banco em vez de chutada, senão o teste passaria a depender de um detalhe interno da criação.
select (select revisao::text from pcm.planos_manutencao where id = '18610000-0000-4000-8000-00000000004a') as rev \gset

-- A operação continua depois da migração: alguém decide sobre um vencimento do plano B. É
-- exatamente o tipo de registro que uma reversão descuidada levaria junto.
insert into pcm.plano_vencimento_decisoes (id, plano_id, versao_id, rotina_id, revisao_plano, ciclo, vencimento, decisao, motivo, request_id, ator_id)
select '18610000-0000-4000-8000-00000000005b', r.plano_id, r.versao_id, r.rotina_id, 1, 1, date '2026-05-20',
  'tratar_manualmente', 'Decisão tomada após a migração', '18610000-0000-4000-8000-0000000000c1', '18610000-0000-4000-8000-000000000001'
from pcm.sso_rascunhos_planos_legados r where r.plano_legado_id = '18610000-0000-4000-8000-00000000004b';

-- ── Gates da reversão: fechados por padrão, como todo o resto ────────────────────────────
select throws_ok(
  format($f$ select pcm.sso_avaliar_reversao_lote_legado(%L,%L,%L,%L,
      jsonb_build_array(jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b1','origemRequestId','18610000-0000-4000-8000-0000000000e1','revisao',%L)),
      'teste') $f$,
    '18610000-0000-4000-8000-000000000001', '18610000-0000-4000-8000-00000000000a',
    '18610000-0000-4000-8000-0000000000a1', '18610000-0000-4000-8000-0000000000d2', :'rev'),
  '55000', 'reversao_lote_desabilitada', 'reverter um lote nasce desabilitado: desfazer migração não é acidente de clique'
);

update pcm.sso_reversao_lote_legado_gate set habilitado = true where id;
update pcm.sso_reversao_rascunho_legado_gate set habilitado = true where id;

-- ── Primeiro: com a cobertura da varredura NÃO declarada, nada é revertido ───────────────
-- A varredura percorre toda coluna com FK apontando para o plano/versão/rotina, mas não alcança
-- dependência sem FK nem escritor que grave por fora. Enquanto ninguém declarar que essa
-- cobertura foi conferida (`sso_reversao_cobertura_completa_gate`), a reversão trata TODO item
-- como dependente. Falhar fechado aqui é o comportamento certo: o erro caro é apagar demais.
select is(
  (pcm.sso_avaliar_reversao_lote_legado('18610000-0000-4000-8000-000000000001', '18610000-0000-4000-8000-00000000000a',
    '18610000-0000-4000-8000-0000000000a0', '18610000-0000-4000-8000-0000000000d2',
    jsonb_build_array(
      jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b8','origemRequestId','18610000-0000-4000-8000-0000000000e1','revisao',:'rev'),
      jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b9','origemRequestId','18610000-0000-4000-8000-0000000000e2','revisao',:'rev')),
    'Antes de declarar cobertura'))->>'revertidos',
  '0', 'sem cobertura de varredura declarada, NENHUM item é revertido — falha fechada'
);

update pcm.sso_reversao_cobertura_completa_gate set habilitado = true where id;

-- ── Agora sim: um item volta, o outro vira pendência ─────────────────────────────────────
select (pcm.sso_avaliar_reversao_lote_legado('18610000-0000-4000-8000-000000000001', '18610000-0000-4000-8000-00000000000a',
  '18610000-0000-4000-8000-0000000000a1', '18610000-0000-4000-8000-0000000000d2',
  jsonb_build_array(
    jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b1','origemRequestId','18610000-0000-4000-8000-0000000000e1','revisao',:'rev'),
    jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b2','origemRequestId','18610000-0000-4000-8000-0000000000e2','revisao',:'rev')),
  'Piloto cancelado pelo PCM')) as reversao \gset

select is(:'reversao'::jsonb->>'revertidos', '1', 'o plano limpo é revertido logicamente');
select is(:'reversao'::jsonb->>'pendentes', '1', 'o plano com dependência NÃO é revertido: fica pendente de reconciliação');
select is(:'reversao'::jsonb->>'historicoApagado', 'false', 'a reversão declara explicitamente que não apagou histórico');

-- O que a operação produziu depois da migração continua lá. É este o ponto do AC-3.
select is(
  (select count(*)::int from pcm.plano_vencimento_decisoes where id = '18610000-0000-4000-8000-00000000005b'),
  1, 'a decisão de vencimento tomada após a migração sobreviveu à reversão'
);
select is(
  (select estado from pcm.planos_manutencao where id = '18610000-0000-4000-8000-00000000004b'),
  'rascunho', 'o plano com dependência não muda de estado: reverter não apaga nem encerra o que está em uso'
);
select is(
  (select estado from pcm.planos_manutencao where id = '18610000-0000-4000-8000-00000000004a'),
  'encerrado', 'o plano limpo é encerrado — a reversão é lógica, não um delete'
);
select is(
  (select count(*)::int from pcm.planos_manutencao where id = '18610000-0000-4000-8000-00000000004a'),
  1, 'mesmo o plano revertido continua existindo: nada é removido fisicamente'
);

-- ── Reverter de novo: idempotente, não muda contagem ─────────────────────────────────────
select is(
  (pcm.sso_avaliar_reversao_lote_legado('18610000-0000-4000-8000-000000000001', '18610000-0000-4000-8000-00000000000a',
    '18610000-0000-4000-8000-0000000000a1', '18610000-0000-4000-8000-0000000000d2',
    jsonb_build_array(
      jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b1','origemRequestId','18610000-0000-4000-8000-0000000000e1','revisao',:'rev'),
      jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b2','origemRequestId','18610000-0000-4000-8000-0000000000e2','revisao',:'rev')),
    'Piloto cancelado pelo PCM')),
  :'reversao'::jsonb, 'reexecutar a reversão devolve o mesmo recibo, sem reverter nada de novo'
);

-- ── Reverter metade do lote é recusado ───────────────────────────────────────────────────
select throws_ok(
  format($f$ select pcm.sso_avaliar_reversao_lote_legado(%L,%L,%L,%L,
      jsonb_build_array(jsonb_build_object('requestId','18610000-0000-4000-8000-0000000000b3','origemRequestId','18610000-0000-4000-8000-0000000000e1','revisao',%L)),
      'Metade') $f$,
    '18610000-0000-4000-8000-000000000001', '18610000-0000-4000-8000-00000000000a',
    '18610000-0000-4000-8000-0000000000a2', '18610000-0000-4000-8000-0000000000d2', :'rev'),
  '42501', 'lote_ou_itens_indisponiveis',
  'reverter só parte do lote é recusado: meio lote revertido é estado que ninguém sabe ler'
);

-- ── O recibo da reversão é prova ─────────────────────────────────────────────────────────
select throws_ok(
  $$ update pcm.sso_reversoes_lote_legado set resultado = '{}'::jsonb where request_id = '18610000-0000-4000-8000-0000000000a1' $$,
  '23514', 'conferencia_imutavel', 'o recibo da reversão é imutável'
);
select is(
  (select count(*)::int from audit.events where action = 'migracao.avaliar_reversao_lote'
     and entity_id = '18610000-0000-4000-8000-0000000000a1'),
  1, 'a reversão deixa exatamente um evento de auditoria, mesmo tendo sido chamada duas vezes'
);

select * from finish();
rollback;
