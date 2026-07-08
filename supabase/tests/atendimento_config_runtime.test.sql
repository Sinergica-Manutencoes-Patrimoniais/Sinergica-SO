-- atendimento_config_runtime.test.sql — pgTAP E02-S10 e E02-S13..S18.
begin;
select plan(28);

-- E02-S10 — métricas e CSAT server-side.
select has_table('atendimento', 'csat_respostas', 'fonte de CSAT existe');
select ok(
  to_regprocedure('atendimento.fn_metrics_snapshot(text)') is not null,
  'snapshot server-side existe'
);

-- E02-S13 — identidade/modelo/janela da persona.
select has_column('atendimento', 'personas', 'modelo_llm', 'persona guarda modelo LLM');
select has_column('atendimento', 'personas', 'janela_inicio', 'persona guarda inicio da janela');
select has_column('atendimento', 'personas', 'janela_fim', 'persona guarda fim da janela');
select has_column('atendimento', 'personas', 'janela_dias', 'persona guarda dias da janela');

-- E02-S14 — operação, lições e especialistas.
select has_column('atendimento', 'personas', 'limite_mensagens_dia', 'persona guarda limite diario');
select has_column('atendimento', 'personas', 'palavras_transferencia', 'persona guarda gatilhos de transferencia');
select has_table('atendimento', 'persona_licoes', 'licoes operacionais existem');
select has_table('atendimento', 'persona_especialistas', 'especialistas existem');

-- E02-S15 — conhecimento e recuperação.
select has_table('atendimento', 'conhecimento_entradas', 'base de conhecimento existe');
select ok(
  to_regprocedure('atendimento.fn_buscar_conhecimento_relevante(uuid,text,integer)') is not null,
  'busca de conhecimento existe'
);

-- E02-S16 — canais Meta, templates e ingestão multicanal.
select has_table('atendimento', 'canais_externos', 'canais externos existem');
select has_table('atendimento', 'wa_templates', 'templates WA existem');
select has_column('atendimento', 'canais_externos', 'waba_id', 'canal Meta WA guarda WABA ID');
select has_column('atendimento', 'conversas', 'provedor', 'conversa identifica provedor');
select ok(
  to_regprocedure(
    'atendimento.fn_registrar_mensagem_canal(text,text,text,text,text,text,text)'
  ) is not null,
  'ingestao multicanal existe'
);

-- E02-S17 — automações e opt-out.
select has_table('atendimento', 'ig_comment_automations', 'automacoes IG existem');
select has_table('atendimento', 'opt_outs', 'opt-outs existem');

-- E02-S18 — scoring e cluster executáveis.
select has_table('atendimento', 'lead_scoring_config', 'config de scoring existe');
select has_table('atendimento', 'cluster_regras', 'regras de cluster existem');
select has_column('atendimento', 'cluster_regras', 'prioridade', 'cluster possui prioridade');
select has_column('comercial', 'leads', 'lead_tier', 'lead guarda tier');
select has_column('comercial', 'leads', 'cluster_nome', 'lead guarda cluster');
select ok(
  to_regprocedure('atendimento.fn_calcular_lead_score(jsonb)') is not null,
  'calculo de score existe'
);
select ok(
  to_regprocedure('atendimento.fn_classificar_cluster(text,text,text)') is not null,
  'classificacao de cluster existe'
);
select is(
  atendimento.fn_calcular_lead_score('[]'::jsonb),
  0,
  'score vazio e deterministico'
);
select throws_ok(
  $$select atendimento.fn_metrics_snapshot('periodo-invalido')$$,
  'P0001',
  'periodo inválido: periodo-invalido (use hoje, 7d ou 30d)',
  'snapshot rejeita periodo invalido'
);

select * from finish();
rollback;
