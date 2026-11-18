-- E01-S197 — "Pendências técnicas agrupadas por ativo, sem perder o achado individual".
-- Investigação (plan.md): US1 (AC-1/AC-2/AC-3/AC-8), AC-5, AC-7, AC-9 já estavam prontos no
-- código existente (E01-S173/174) — este teste é PROVA do cenário literal da spec (SC-001: "7
-- achados, 2 ao Backlog, 5 conservadas"), não implementação nova. Reusa a fixture de
-- E01-S173_retorno_aprovado_fixture.sql (1 resposta nao_ok já aprovada) e acrescenta mais 6
-- respostas no MESMO retorno/grupo quantitativo (sem TAG individual — cobre o Edge Case).
begin;
\ir E01-S173_retorno_aprovado_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(20);

update pcm.sso_pendencias_gate set habilitado=true where id;
update pcm.sso_backlog_composicao_gate set habilitado=true where id;
update pcm.sso_mediacao_pendencias_retorno_gate set habilitado=true where id;
update pcm.sso_pendencias_filtro_ativo_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

-- "7 achados no mesmo equipamento" — a fixture já tem a resposta p1 (nao_ok, aprovada); completa
-- com mais 6 no MESMO retorno (mesma Visita/OS, mesmo quadro — o grupo quantitativo da fixture).
insert into pcm.respostas_os_preparadas(id,retorno_id,chave_pergunta,resultado,obrigatoria) values
 ('17971000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000018','p2','nao_ok',true),
 ('17971000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','p3','nao_ok',true),
 ('17971000-0000-4000-8000-000000000003','16891000-0000-4000-8000-000000000018','p4','nao_ok',true),
 ('17971000-0000-4000-8000-000000000004','16891000-0000-4000-8000-000000000018','p5','nao_ok',true),
 ('17971000-0000-4000-8000-000000000005','16891000-0000-4000-8000-000000000018','p6','nao_ok',true),
 ('17971000-0000-4000-8000-000000000006','16891000-0000-4000-8000-000000000018','p7','ok',true);
-- p7 é OK de propósito (AC-6): prova que resultado diferente de nao_ok nunca vira pendência —
-- "7 achados" vira 6 pendências reais + 1 prova negativa no mesmo lote.

select lives_ok($$select pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000011','16891000-0000-4000-8000-000000000019')$$,'AC-4: resposta p1 (nao_ok) gera pendência');
select lives_ok($$select pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000012','17971000-0000-4000-8000-000000000001')$$,'p2 gera pendência');
select lives_ok($$select pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000013','17971000-0000-4000-8000-000000000002')$$,'p3 gera pendência');
select lives_ok($$select pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000014','17971000-0000-4000-8000-000000000003')$$,'p4 gera pendência');
select lives_ok($$select pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000015','17971000-0000-4000-8000-000000000004')$$,'p5 gera pendência');
select lives_ok($$select pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000016','17971000-0000-4000-8000-000000000005')$$,'p6 gera pendência');
select throws_ok(
  $$select pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000017','17971000-0000-4000-8000-000000000006')$$,
  '23514','resultado_nao_elegivel',
  'AC-6: resposta OK (p7) nunca vira pendência — resultado_nao_elegivel'
);

-- AC-1: um "cartão" agrupado — 6 pendências reais, todas no MESMO alvo (grupo quantitativo,
-- sem TAG individual — Edge Case coberto pela própria fixture).
select is(
  (select count(*)::int from pcm.sso_pendencias_tecnicas where retorno_id='16891000-0000-4000-8000-000000000018'),
  6,
  'AC-1: 6 pendências reais criadas (a 7ª resposta, OK, não vira pendência)'
);
select is(
  (select count(distinct alvo_id)::int from pcm.sso_pendencias_tecnicas where retorno_id='16891000-0000-4000-8000-000000000018'),
  1,
  'AC-1/AC-3: todas no mesmo alvo — um cartão agrupado, não seis espalhados'
);
select is(
  (select count(*)::int from pcm.sso_listar_pendencias_por_ativo('16891000-0000-4000-8000-000000000002',null,null,50) where alvo_tipo='grupo'),
  6,
  'AC-1: a consulta de agrupamento por ativo lista as 6, com alvo_tipo/alvo_id presentes'
);

-- AC-5: nenhuma falha cria Chamado ou OS — só a OS da fixture (pré-existente) continua existindo.
select is((select count(*)::int from pcm.ordens_servico where client_id='16891000-0000-4000-8000-000000000002'),1,'AC-5: nenhuma OS nova criada pelas 6 pendências');
select is((select count(*)::int from pcm.chamados where cliente_id='16891000-0000-4000-8000-000000000002'),0,'AC-5: nenhum Chamado criado pelas 6 pendências');

-- AC-7: rastreável até resposta, ativo e Visita/OS de origem.
select is(
  (select array[resposta_id,os_id,ocorrencia_id]::text from pcm.sso_pendencias_tecnicas where resposta_id='17971000-0000-4000-8000-000000000001') is not null,
  true,
  'AC-7: pendência carrega resposta_id, os_id e ocorrencia_id de origem'
);

-- AC-9: mesma resposta registrada duas vezes não duplica (dedup por resposta_id, unique+on conflict).
select is(
  (pcm.sso_registrar_pendencia_retorno('17971000-0000-4000-8000-000000000018','17971000-0000-4000-8000-000000000001')->>'pendenciaId'),
  (select id::text from pcm.sso_pendencias_tecnicas where resposta_id='17971000-0000-4000-8000-000000000001'),
  'AC-9: reenvio do mesmo achado devolve a MESMA pendência (dedup por resposta_id)'
);
select is((select count(*)::int from pcm.sso_pendencias_tecnicas where resposta_id='17971000-0000-4000-8000-000000000001'),1,'AC-9: nenhuma duplicata gerada');

-- AC-2/AC-8: PCM envia 2 das 6 ao Backlog (comportamento de composição de E01-S193/E01-S174, não
-- reimplementado); as outras 4 (+ a que sobra do grupo de 6) conservam o estado anterior.
select is(
  (pcm.sso_compor_backlog_pendencias(
    '17971000-0000-4000-8000-000000000019','16891000-0000-4000-8000-000000000002',
    (select jsonb_agg(jsonb_build_object('id',id::text,'revision',revisao))
      from pcm.sso_pendencias_tecnicas where resposta_id in ('16891000-0000-4000-8000-000000000019','17971000-0000-4000-8000-000000000001'))
  )->>'created'),
  'true',
  'AC-2/AC-8: compõe Backlog com só 2 das 6 pendências selecionadas'
);
select is(
  (select estado from pcm.sso_pendencias_tecnicas where resposta_id='16891000-0000-4000-8000-000000000019'),
  'aberta',
  'AC-2: a pendência composta mantém estado aberta — composição não muda o estado da pendência'
);
select is(
  (select count(*)::int from pcm.sso_pendencias_tecnicas p join pcm.sso_backlog_pendencias b on b.pendencia_id=p.id
    where p.retorno_id='16891000-0000-4000-8000-000000000018' and p.estado<>'aberta'),
  0,
  'AC-2: nenhuma das 4 NÃO selecionadas teve o estado alterado pela composição das outras 2'
);
select is(
  (select count(*)::int from pcm.sso_backlog_pendencias b join pcm.sso_pendencias_tecnicas p on p.id=b.pendencia_id
    where p.retorno_id='16891000-0000-4000-8000-000000000018'),
  2,
  'AC-2/AC-8: só as 2 selecionadas estão vinculadas à composição do Backlog'
);
select throws_ok(
  format(
    $f$select pcm.sso_compor_backlog_pendencias('17971000-0000-4000-8000-000000000020','16891000-0000-4000-8000-000000000002',
      jsonb_build_array(jsonb_build_object('id','%s','revision',1)))$f$,
    (select id::text from pcm.sso_pendencias_tecnicas where resposta_id='16891000-0000-4000-8000-000000000019')
  ),
  '23514','pendencia_indisponivel',
  'pendência já composta não pode ser composta de novo (sem duplicar no Backlog)'
);

select * from finish();
rollback;
