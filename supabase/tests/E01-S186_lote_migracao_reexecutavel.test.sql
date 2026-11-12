-- E01-S186 US1 / SSO-021 (AC-3) — "mesmo lote repetido não duplica; reversão mantém pendência de
-- reconciliação em vez de apagar".
--
-- POR QUE ESTE ARQUIVO EXISTE
-- A US1 (migrar legado por prévia e lotes reexecutáveis) tem 20+ migrations e, até aqui, nenhum
-- pgTAP. A própria story registrou isso como "o maior risco concreto de todas as stories
-- auditadas", e a conferência do Caderno recomendou não validar lote de migração com dado de
-- produção antes de existir pelo menos uma prova de que reexecutar não duplica. É essa prova.
--
-- O recorte é deliberado: não testa o caminho feliz da migração inteira (isso é homologação por
-- onda, AC-4/5/6), e sim a propriedade que torna um piloto SEGURO de repetir — porque é
-- exatamente isso que acontece num piloto real quando a rede cai no meio, o operador recarrega a
-- tela, ou o lote é reenviado por engano.
--
-- O caminho exercitado é o real: `sso_aceitar_previa_lote_legado` -> `sso_criar_lote_legado_aceito`
-- são as duas únicas funções da família com grant para `authenticated` (migration 1388); o
-- criador do lote é privado e só é alcançado por elas.
begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18600000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's186-lote@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18600000-0000-4000-8000-000000000001', 'superadmin', 'S186 Lote', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18600000-0000-4000-8000-00000000000a', 'Cliente S186 Lote', true, '18600000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18600000-0000-4000-8000-000000000001', 'plano.gerir', '18600000-0000-4000-8000-00000000000a');
insert into pcm.sistemas (id, cliente_id, nome, created_by) values
 ('18600000-0000-4000-8000-00000000001a', '18600000-0000-4000-8000-00000000000a', 'Sistema de incêndio', '18600000-0000-4000-8000-000000000001'),
 ('18600000-0000-4000-8000-00000000001b', '18600000-0000-4000-8000-00000000000a', 'Sistema de climatização', '18600000-0000-4000-8000-000000000001');
insert into pcm.questionarios (id, auvo_id, nome) values
 ('18600000-0000-4000-8000-00000000002a', 918600, 'Checklist legado');
insert into pcm.tipos_tarefa (id, nome) values
 ('18600000-0000-4000-8000-00000000003a', 'Preventiva legada');

-- Dois planos legados, o insumo real de um piloto.
insert into pcm.planos_preventivos (id, cliente_id, sistema_id, questionario_id, tipo_tarefa_id, nome, primeira_data, intervalo_unidade, intervalo_n, created_by) values
 ('18600000-0000-4000-8000-00000000004a', '18600000-0000-4000-8000-00000000000a', '18600000-0000-4000-8000-00000000001a', '18600000-0000-4000-8000-00000000002a', '18600000-0000-4000-8000-00000000003a', 'Inspeção de extintores', date '2026-01-10', 'meses', 6, '18600000-0000-4000-8000-000000000001'),
 ('18600000-0000-4000-8000-00000000004b', '18600000-0000-4000-8000-00000000000a', '18600000-0000-4000-8000-00000000001b', '18600000-0000-4000-8000-00000000002a', '18600000-0000-4000-8000-00000000003a', 'Limpeza de filtros', date '2026-02-20', 'meses', 3, '18600000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- A fotografia tem que bater byte a byte com a linha de origem: é assim que o sistema detecta
-- que o legado mudou entre a prévia e a execução. Montar à mão aqui seria testar o teste.
reset role;
select jsonb_build_array(
  jsonb_build_object('requestId','18600000-0000-4000-8000-0000000000e1','planoId','18600000-0000-4000-8000-00000000004a',
    'rotinaId','18600000-0000-4000-8000-0000000000f1','fotografia',(select to_jsonb(p) from pcm.planos_preventivos p where p.id='18600000-0000-4000-8000-00000000004a'),
    'modo','calendario','intervalo','6','unidade','meses','dataBase','2026-01-10','antes','5','depois','5'),
  jsonb_build_object('requestId','18600000-0000-4000-8000-0000000000e2','planoId','18600000-0000-4000-8000-00000000004b',
    'rotinaId','18600000-0000-4000-8000-0000000000f2','fotografia',(select to_jsonb(p) from pcm.planos_preventivos p where p.id='18600000-0000-4000-8000-00000000004b'),
    'modo','calendario','intervalo','3','unidade','meses','dataBase','2026-02-20','antes','5','depois','5')
)::text as itens \gset

set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── Gates: 4 travas, todas fechadas por padrão ────────────────────────────────────────────
select throws_ok(
  format($f$ select pcm.sso_aceitar_previa_lote_legado(%L,%L,%L,%L::jsonb,true) $f$,
    '18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-00000000000a',
    '18600000-0000-4000-8000-0000000000d1', :'itens'),
  '55000', 'aceite_desabilitado', 'o aceite de prévia nasce desabilitado: migração não começa por acidente'
);

reset role;
update pcm.sso_aceite_lote_legado_gate set habilitado = true where id;
update pcm.sso_lote_rascunhos_legados_gate set habilitado = true where id;
update pcm.sso_rascunho_plano_legado_gate set habilitado = true where id;
update pcm.migracao_preflight_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- ── Prévia aceita, e o aceite não é migração ──────────────────────────────────────────────
select (pcm.sso_aceitar_previa_lote_legado('18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-00000000000a',
  '18600000-0000-4000-8000-0000000000d1', :'itens'::jsonb, true)) as aceite \gset
select is(:'aceite'::jsonb->>'quantidade', '2', 'a prévia aceita conta os 2 planos selecionados');
select is(:'aceite'::jsonb->>'migracaoExecutada', 'false', 'aceitar a prévia NÃO executa a migração — são dois atos separados');
select is(:'aceite'::jsonb->>'equivalenciaComprovada', 'false', 'aceitar também não declara equivalência com o legado');

-- ── O lote roda ───────────────────────────────────────────────────────────────────────────
select (pcm.sso_criar_lote_legado_aceito('18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-00000000000a',
  '18600000-0000-4000-8000-0000000000d2', '18600000-0000-4000-8000-0000000000d1')) as lote \gset
select is(:'lote'::jsonb->>'quantidade', '2', 'o lote processa os 2 itens aceitos');
-- As tabelas da migração são privadas (revogadas de todos os papéis): quem confere é o dono.
reset role;
select is(
  (select count(*)::int from pcm.sso_rascunhos_planos_legados where cliente_id = '18600000-0000-4000-8000-00000000000a'),
  2, 'dois rascunhos criados, um por plano legado'
);
set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(:'lote'::jsonb->>'aprovacaoRealizada', 'false', 'migrar cria RASCUNHO: nada é aprovado pela migração');

-- ── AC-3, o ponto central: reexecutar o MESMO lote ────────────────────────────────────────
-- É o que acontece num piloto real quando a rede cai, o operador recarrega a tela ou o lote é
-- reenviado por engano. As contagens têm que ser iguais e nada pode duplicar.
select (pcm.sso_criar_lote_legado_aceito('18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-00000000000a',
  '18600000-0000-4000-8000-0000000000d2', '18600000-0000-4000-8000-0000000000d1')) as lote_replay \gset
select is(:'lote_replay'::jsonb, :'lote'::jsonb, 'reexecutar o mesmo lote devolve exatamente o mesmo recibo');
reset role;
select is(
  (select count(*)::int from pcm.sso_rascunhos_planos_legados where cliente_id = '18600000-0000-4000-8000-00000000000a'),
  2, 'reexecutar NÃO duplica: continuam 2 rascunhos, não 4'
);
select is(
  (select count(*)::int from pcm.planos_manutencao where cliente_id = '18600000-0000-4000-8000-00000000000a'),
  2, 'e também não duplica o que foi criado no destino'
);
set local request.jwt.claims = '{"sub":"18600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;


-- ── Mesmo identificador, conteúdo diferente: recusa em vez de sobrescrever ────────────────
select throws_ok(
  format($f$ select pcm.sso_aceitar_previa_lote_legado(%L,%L,%L,%L::jsonb,true) $f$,
    '18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-00000000000a',
    '18600000-0000-4000-8000-0000000000d1',
    (select jsonb_build_array((:'itens'::jsonb)->0)::text)),
  '23505', 'request_id_conflitante',
  'mesmo requestId com seleção diferente é recusado: replay não vira sobrescrita silenciosa'
);

-- ── Lote NOVO sobre item já migrado: reconciliação, não duplicata ─────────────────────────
-- O operador que tenta "rodar de novo com outro identificador" não consegue criar um segundo
-- rascunho do mesmo plano legado: a própria prévia recusa, porque o destino já existe. É o item
-- do AC-3 que protege execução e financeiro de serem duplicados por reexecução — a saída é
-- reconciliar o que já foi migrado, não migrar de novo por cima.
select throws_ok(
  format($f$ select pcm.sso_aceitar_previa_lote_legado(%L,%L,%L,
      jsonb_build_array(jsonb_build_object(
        'requestId','18600000-0000-4000-8000-0000000000e3','planoId','18600000-0000-4000-8000-00000000004a',
        'rotinaId','18600000-0000-4000-8000-0000000000f3','fotografia',%L::jsonb,
        'modo','calendario','intervalo','6','unidade','meses','dataBase','2026-01-10','antes','5','depois','5')),
      true) $f$,
    '18600000-0000-4000-8000-000000000001', '18600000-0000-4000-8000-00000000000a',
    '18600000-0000-4000-8000-0000000000d3', ((:'itens'::jsonb)->0->'fotografia')::text),
  '40001', 'origem_alterada_ou_existente',
  'lote novo sobre plano já migrado é recusado: a saída é reconciliar, não migrar por cima'
);

-- ── O recibo do lote é prova, e prova não se edita ────────────────────────────────────────
reset role;
select throws_ok(
  $$ update pcm.sso_lotes_rascunhos_legados set resultado = '{}'::jsonb where request_id = '18600000-0000-4000-8000-0000000000d2' $$,
  '23514', 'conferencia_imutavel',
  'o recibo do lote é imutável — sem isso, "reexecutar não duplicou" seria afirmação sem lastro'
);
select throws_ok(
  $$ delete from pcm.sso_lotes_rascunhos_legados where request_id = '18600000-0000-4000-8000-0000000000d2' $$,
  '23514', 'conferencia_imutavel',
  'o recibo do lote também não pode ser apagado'
);
select is(
  (select count(*)::int from audit.events where action = 'migracao.lote_rascunhos_legados'
     and entity_id = '18600000-0000-4000-8000-0000000000d2'),
  1, 'a execução do lote deixa exatamente um evento de auditoria — nem zero, nem um por replay'
);

select * from finish();
rollback;
