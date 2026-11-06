-- Requer migrations aplicadas; este teste apenas prepara verificações de fronteira, sem rede.
begin;
select plan(5);
select ok(has_function_privilege('authenticated','pcm.sso_confirmar_esforco_restante(uuid,uuid,uuid,uuid,integer,text)','execute'),
  'comando autenticado está disponível, mas protegido pelo gate');
select ok(has_function_privilege('authenticated','pcm.sso_fontes_esforco_restante(uuid,date,uuid,integer)','execute'),
  'leitura autenticada está disponível, mas protegida pelo gate');
select ok(not has_table_privilege('authenticated','pcm.sso_esforco_restante_confirmacoes','select'),
  'confirmações não ficam disponíveis diretamente');
select ok(not has_table_privilege('authenticated','pcm.sso_esforco_restante_confirmacoes','insert'),
  'confirmações exigem comando auditado');
select throws_ok($$select pcm.sso_confirmar_esforco_restante(null,null,null,null,null,null)$$,
  '55000','confirmacao_desabilitada','gate fechado recusa escrita');
select * from finish();
rollback;
