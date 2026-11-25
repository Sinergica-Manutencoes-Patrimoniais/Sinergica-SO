-- E01-S185_destrava_reconciliacao.test.sql — pgTAP da migration 1875.
-- Prova três coisas sobre o destrave da jornada de reconciliação, com o schema aplicado:
--   1. as 23 travas autorizadas estão ABERTAS (se alguém reverter a 1875 ou recriar uma delas
--      fechada, a CI acusa em vez de a tela voltar a sumir em silêncio);
--   2. as 3 travas de varredura periódica continuam FECHADAS — decisão do ADR-1264, e a única
--      forma de garantir que o destrave em massa não as levou de carona;
--   3. nenhuma delas foi afrouxada no RLS para "facilitar" a abertura: quem lê o gate é a função
--      security definer, nunca o cliente.
begin;
select plan(28);

select is((select habilitado from pcm.reconciliacao_outbox_gate where id), true,
 'pcm.reconciliacao_outbox_gate aberta');
select is((select habilitado from pcm.reconciliacao_revisao_fila_gate where id), true,
 'pcm.reconciliacao_revisao_fila_gate aberta');
select is((select habilitado from pcm.sso_origens_internas_mediadas_gate where id), true,
 'pcm.sso_origens_internas_mediadas_gate aberta');
select is((select habilitado from pcm.sso_eventos_origens_mediados_gate where id), true,
 'pcm.sso_eventos_origens_mediados_gate aberta');
select is((select habilitado from pcm.sso_observacao_fila_gate where id), true,
 'pcm.sso_observacao_fila_gate aberta');
select is((select habilitado from pcm.sso_observacao_os_gate where id), true,
 'pcm.sso_observacao_os_gate aberta');
select is((select habilitado from pcm.sso_observacao_novo_cliente_gate where id), true,
 'pcm.sso_observacao_novo_cliente_gate aberta');
select is((select habilitado from pcm.sso_triagem_intencoes_os_gate where id), true,
 'pcm.sso_triagem_intencoes_os_gate aberta');
select is((select habilitado from pcm.reconciliacao_funcionario_gate where id), true,
 'pcm.reconciliacao_funcionario_gate aberta');
select is((select habilitado from pcm.reconciliacao_orfaos_admin_gate where id), true,
 'pcm.reconciliacao_orfaos_admin_gate aberta');
select is((select habilitado from pcm.reconciliacao_os_avaliacao_gate where id), true,
 'pcm.reconciliacao_os_avaliacao_gate aberta');
select is((select habilitado from pcm.reconciliacao_os_evidencia_gate where id), true,
 'pcm.reconciliacao_os_evidencia_gate aberta');
select is((select habilitado from pcm.sso_solicitacao_recuperacao_gate where id), true,
 'pcm.sso_solicitacao_recuperacao_gate aberta');
select is((select habilitado from pcm.reconciliacao_retry_incerto_gate where id), true,
 'pcm.reconciliacao_retry_incerto_gate aberta');
select is((select habilitado from pcm.sso_quarentena_fila_gate where id), true,
 'pcm.sso_quarentena_fila_gate aberta');
select is((select habilitado from pcm.sso_confirmacao_retorno_fila_gate where id), true,
 'pcm.sso_confirmacao_retorno_fila_gate aberta');
select is((select habilitado from pcm.sso_confirmacao_retorno_os_gate where id), true,
 'pcm.sso_confirmacao_retorno_os_gate aberta');
select is((select habilitado from pcm.sso_conflito_webhook_chamado_gate where id), true,
 'pcm.sso_conflito_webhook_chamado_gate aberta');
select is((select habilitado from pcm.sso_consulta_conflitos_webhook_gate where id), true,
 'pcm.sso_consulta_conflitos_webhook_gate aberta');
select is((select habilitado from pcm.sso_resolucao_conflito_webhook_gate where id), true,
 'pcm.sso_resolucao_conflito_webhook_gate aberta');
select is((select habilitado from pcm.sso_config_demora_gate where id), true,
 'pcm.sso_config_demora_gate aberta');
select is((select habilitado from pcm.sso_config_executor_fila_gate where id), true,
 'pcm.sso_config_executor_fila_gate aberta');
select is((select habilitado from pcm.sso_diagnostico_executor_admin_gate where id), true,
 'pcm.sso_diagnostico_executor_admin_gate aberta');

-- ADR-1264: a varredura periódica escreve (ocorrência, demora, quarentena) sem ator humano e
-- nenhuma tela a alcança. Fica fechada até decisão própria.
select is((select habilitado from pcm.sso_varredura_fila_gate where id), false,
 'pcm.sso_varredura_fila_gate segue FECHADA por ADR-1264');
select is((select habilitado from pcm.sso_varredura_os_gate where id), false,
 'pcm.sso_varredura_os_gate segue FECHADA por ADR-1264');
select is((select habilitado from pcm.sso_varredura_origens_gate where id), false,
 'pcm.sso_varredura_origens_gate segue FECHADA por ADR-1264');

-- Inventário: as 26 travas da story continuam existindo, com RLS enable + force.
select is(
 (select count(*) from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'pcm' and c.relname in ('reconciliacao_outbox_gate','reconciliacao_revisao_fila_gate','sso_origens_internas_mediadas_gate','sso_eventos_origens_mediados_gate','sso_observacao_fila_gate','sso_observacao_os_gate','sso_observacao_novo_cliente_gate','sso_triagem_intencoes_os_gate','reconciliacao_funcionario_gate','reconciliacao_orfaos_admin_gate','reconciliacao_os_avaliacao_gate','reconciliacao_os_evidencia_gate','sso_solicitacao_recuperacao_gate','reconciliacao_retry_incerto_gate','sso_quarentena_fila_gate','sso_confirmacao_retorno_fila_gate','sso_confirmacao_retorno_os_gate','sso_conflito_webhook_chamado_gate','sso_consulta_conflitos_webhook_gate','sso_resolucao_conflito_webhook_gate','sso_config_demora_gate','sso_config_executor_fila_gate','sso_diagnostico_executor_admin_gate','sso_varredura_fila_gate','sso_varredura_os_gate','sso_varredura_origens_gate')),
 26::bigint,
 'as 26 travas da reconciliação seguem catalogadas');
select is(
 (select count(*) from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'pcm' and c.relname in ('reconciliacao_outbox_gate','reconciliacao_revisao_fila_gate','sso_origens_internas_mediadas_gate','sso_eventos_origens_mediados_gate','sso_observacao_fila_gate','sso_observacao_os_gate','sso_observacao_novo_cliente_gate','sso_triagem_intencoes_os_gate','reconciliacao_funcionario_gate','reconciliacao_orfaos_admin_gate','reconciliacao_os_avaliacao_gate','reconciliacao_os_evidencia_gate','sso_solicitacao_recuperacao_gate','reconciliacao_retry_incerto_gate','sso_quarentena_fila_gate','sso_confirmacao_retorno_fila_gate','sso_confirmacao_retorno_os_gate','sso_conflito_webhook_chamado_gate','sso_consulta_conflitos_webhook_gate','sso_resolucao_conflito_webhook_gate','sso_config_demora_gate','sso_config_executor_fila_gate','sso_diagnostico_executor_admin_gate','sso_varredura_fila_gate','sso_varredura_os_gate','sso_varredura_origens_gate')
    and c.relrowsecurity and c.relforcerowsecurity),
 26::bigint,
 'todas as travas da reconciliação seguem com RLS enable + force');

select * from finish();
rollback;
