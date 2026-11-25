-- E00-S30_destrava_financeiro_comercial.test.sql — pgTAP da migration 1872.
-- Prova que as 72 travas do Financeiro e do Comercial estão abertas com o schema aplicado, que o
-- inventário não mudou de tamanho por baixo e que nenhuma delas foi afrouxada no RLS para
-- "facilitar" a abertura (quem lê o gate é a função security definer, nunca o cliente).
--
-- Por que isto existe: a abertura das travas do PCM (24/11) foi feita à mão no console, então o
-- banco de CI nunca soube dela. Aqui a abertura é parte do schema — se alguém reverter a 1872 ou
-- recriar um gate fechado, a CI acusa.
begin;
select plan(74);

select is((select habilitado from comercial.sso_assessment_cliente_gate where id), true,
 'comercial.sso_assessment_cliente_gate aberta');
select is((select habilitado from comercial.sso_classificacao_linha_gate where id), true,
 'comercial.sso_classificacao_linha_gate aberta');
select is((select leitura and escrita from comercial.sso_classificacao_mediada_gate where id), true,
 'comercial.sso_classificacao_mediada_gate aberta para leitura e escrita');
select is((select habilitado from comercial.sso_composicao_mista_gate where id), true,
 'comercial.sso_composicao_mista_gate aberta');
select is((select habilitado from comercial.sso_composicao_parcelas_gate where id), true,
 'comercial.sso_composicao_parcelas_gate aberta');
select is((select habilitado from comercial.sso_consulta_parcelas_orcamento_gate where id), true,
 'comercial.sso_consulta_parcelas_orcamento_gate aberta');
select is((select habilitado from comercial.sso_correlacao_gasto_gate where id), true,
 'comercial.sso_correlacao_gasto_gate aberta');
select is((select habilitado from comercial.sso_correlacao_mediada_gate where id), true,
 'comercial.sso_correlacao_mediada_gate aberta');
select is((select habilitado from comercial.sso_decisao_correlacao_gate where id), true,
 'comercial.sso_decisao_correlacao_gate aberta');
select is((select habilitado from comercial.sso_decisao_pcm_orcamento_gate where id), true,
 'comercial.sso_decisao_pcm_orcamento_gate aberta');
select is((select habilitado from comercial.sso_dispensa_orcamento_gate where id), true,
 'comercial.sso_dispensa_orcamento_gate aberta');
select is((select habilitado from comercial.sso_escrita_assessment_gate where id), true,
 'comercial.sso_escrita_assessment_gate aberta');
select is((select habilitado from comercial.sso_excecao_preco_gate where id), true,
 'comercial.sso_excecao_preco_gate aberta');
select is((select leitura and escrita from comercial.sso_excecao_preco_mediada_gate where id), true,
 'comercial.sso_excecao_preco_mediada_gate aberta para leitura e escrita');
select is((select habilitado from comercial.sso_exportacao_operacional_gate where id), true,
 'comercial.sso_exportacao_operacional_gate aberta');
select is((select habilitado from comercial.sso_fonte_aquisicao_gate where id), true,
 'comercial.sso_fonte_aquisicao_gate aberta');
select is((select habilitado from comercial.sso_guarda_fonte_retificada_gate where id), true,
 'comercial.sso_guarda_fonte_retificada_gate aberta');
select is((select habilitado from comercial.sso_historico_fontes_orcamento_gate where id), true,
 'comercial.sso_historico_fontes_orcamento_gate aberta');
select is((select habilitado from comercial.sso_historico_legado_operacional_gate where id), true,
 'comercial.sso_historico_legado_operacional_gate aberta');
select is((select habilitado from comercial.sso_historico_legado_pre_os_gate where id), true,
 'comercial.sso_historico_legado_pre_os_gate aberta');
select is((select habilitado from comercial.sso_inventario_assessment_gate where id), true,
 'comercial.sso_inventario_assessment_gate aberta');
select is((select habilitado from comercial.sso_itens_publicos_gate where id), true,
 'comercial.sso_itens_publicos_gate aberta');
select is((select habilitado from comercial.sso_orcamento_operacional_gate where id), true,
 'comercial.sso_orcamento_operacional_gate aberta');
select is((select habilitado from comercial.sso_origem_operacional_gate where id), true,
 'comercial.sso_origem_operacional_gate aberta');
select is((select habilitado from comercial.sso_painel_operacional_gate where id), true,
 'comercial.sso_painel_operacional_gate aberta');
select is((select habilitado from comercial.sso_retificacao_classificacao_gate where id), true,
 'comercial.sso_retificacao_classificacao_gate aberta');
select is((select habilitado from comercial.sso_retificacao_fonte_aquisicao_gate where id), true,
 'comercial.sso_retificacao_fonte_aquisicao_gate aberta');
select is((select habilitado from comercial.sso_retificacao_fonte_utilizada_gate where id), true,
 'comercial.sso_retificacao_fonte_utilizada_gate aberta');
select is((select habilitado from comercial.sso_vinculo_assessment_gate where id), true,
 'comercial.sso_vinculo_assessment_gate aberta');
select is((select habilitado from comercial.sso_visibilidade_orcamento_gate where id), true,
 'comercial.sso_visibilidade_orcamento_gate aberta');
select is((select habilitado from financeiro.sso_alocacao_documento_mediada_gate where id), true,
 'financeiro.sso_alocacao_documento_mediada_gate aberta');
select is((select habilitado from financeiro.sso_anexo_faturavel_gate where id), true,
 'financeiro.sso_anexo_faturavel_gate aberta');
select is((select habilitado from financeiro.sso_atestacao_servico_gate where id), true,
 'financeiro.sso_atestacao_servico_gate aberta');
select is((select habilitado from financeiro.sso_autorizacao_complemento_gate where id), true,
 'financeiro.sso_autorizacao_complemento_gate aberta');
select is((select habilitado from financeiro.sso_candidato_linha_gate where id), true,
 'financeiro.sso_candidato_linha_gate aberta');
select is((select habilitado from financeiro.sso_candidato_servico_gate where id), true,
 'financeiro.sso_candidato_servico_gate aberta');
select is((select habilitado from financeiro.sso_cobranca_os_gate where id), true,
 'financeiro.sso_cobranca_os_gate aberta');
select is((select habilitado from financeiro.sso_comandos_servico_extra_mediado_gate where id), true,
 'financeiro.sso_comandos_servico_extra_mediado_gate aberta');
select is((select habilitado from financeiro.sso_conferencia_candidato_servico_gate where id), true,
 'financeiro.sso_conferencia_candidato_servico_gate aberta');
select is((select habilitado from financeiro.sso_conferencia_origem_gate where id), true,
 'financeiro.sso_conferencia_origem_gate aberta');
select is((select habilitado from financeiro.sso_coordenacao_linhas_gate where id), true,
 'financeiro.sso_coordenacao_linhas_gate aberta');
select is((select leitura and escrita from financeiro.sso_correcao_faturavel_mediada_gate where id), true,
 'financeiro.sso_correcao_faturavel_mediada_gate aberta para leitura e escrita');
select is((select habilitado from financeiro.sso_documento_cobranca_gate where id), true,
 'financeiro.sso_documento_cobranca_gate aberta');
select is((select habilitado from financeiro.sso_documento_interno_gate where id), true,
 'financeiro.sso_documento_interno_gate aberta');
select is((select habilitado from financeiro.sso_exigir_autorizacao_complemento_gate where id), true,
 'financeiro.sso_exigir_autorizacao_complemento_gate aberta');
select is((select habilitado from financeiro.sso_fato_execucao_declarado_gate where id), true,
 'financeiro.sso_fato_execucao_declarado_gate aberta');
select is((select habilitado from financeiro.sso_faturamento_gate where id), true,
 'financeiro.sso_faturamento_gate aberta');
select is((select habilitado from financeiro.sso_filtro_faturaveis_gate where id), true,
 'financeiro.sso_filtro_faturaveis_gate aberta');
select is((select habilitado from financeiro.sso_guarda_reconciliacao_material_gate where id), true,
 'financeiro.sso_guarda_reconciliacao_material_gate aberta');
select is((select habilitado from financeiro.sso_historico_faturavel_todas_origens_gate where id), true,
 'financeiro.sso_historico_faturavel_todas_origens_gate aberta');
select is((select habilitado from financeiro.sso_identificar_fato_mediado_gate where id), true,
 'financeiro.sso_identificar_fato_mediado_gate aberta');
select is((select habilitado from financeiro.sso_leitura_fato_servico_gate where id), true,
 'financeiro.sso_leitura_fato_servico_gate aberta');
select is((select habilitado from financeiro.sso_leituras_faturaveis_gate where id), true,
 'financeiro.sso_leituras_faturaveis_gate aberta');
select is((select habilitado from financeiro.sso_material_declaracao_gate where id), true,
 'financeiro.sso_material_declaracao_gate aberta');
select is((select habilitado from financeiro.sso_modo_faturamento_gate where id), true,
 'financeiro.sso_modo_faturamento_gate aberta');
select is((select habilitado from financeiro.sso_parcela_adicional_gate where id), true,
 'financeiro.sso_parcela_adicional_gate aberta');
select is((select habilitado from financeiro.sso_previa_origem_servico_gate where id), true,
 'financeiro.sso_previa_origem_servico_gate aberta');
select is((select habilitado from financeiro.sso_proposta_faturavel_gate where id), true,
 'financeiro.sso_proposta_faturavel_gate aberta');
select is((select habilitado from financeiro.sso_reconciliacao_mediada_gate where id), true,
 'financeiro.sso_reconciliacao_mediada_gate aberta');
select is((select habilitado from financeiro.sso_reconciliacao_servico_material_gate where id), true,
 'financeiro.sso_reconciliacao_servico_material_gate aberta');
select is((select habilitado from financeiro.sso_recuperar_parcela_gate where id), true,
 'financeiro.sso_recuperar_parcela_gate aberta');
select is((select habilitado from financeiro.sso_relatorio_despesas_mediado_gate where id), true,
 'financeiro.sso_relatorio_despesas_mediado_gate aberta');
select is((select habilitado from financeiro.sso_repasse_despesa_gate where id), true,
 'financeiro.sso_repasse_despesa_gate aberta');
select is((select habilitado from financeiro.sso_reserva_documento_liberacao_gate where id), true,
 'financeiro.sso_reserva_documento_liberacao_gate aberta');
select is((select habilitado from financeiro.sso_revisao_origens_reconciliacao_gate where id), true,
 'financeiro.sso_revisao_origens_reconciliacao_gate aberta');
select is((select habilitado from financeiro.sso_revogacao_autorizacao_complemento_gate where id), true,
 'financeiro.sso_revogacao_autorizacao_complemento_gate aberta');
select is((select habilitado from financeiro.sso_selecao_documento_gate where id), true,
 'financeiro.sso_selecao_documento_gate aberta');
select is((select habilitado from financeiro.sso_servico_extra_gate where id), true,
 'financeiro.sso_servico_extra_gate aberta');
select is((select habilitado from financeiro.sso_snapshot_servico_extra_gate where id), true,
 'financeiro.sso_snapshot_servico_extra_gate aberta');
select is((select habilitado from financeiro.sso_snapshot_servico_mediado_gate where id), true,
 'financeiro.sso_snapshot_servico_mediado_gate aberta');
select is((select habilitado from financeiro.sso_vinculo_resposta_servico_gate where id), true,
 'financeiro.sso_vinculo_resposta_servico_gate aberta');
select is((select habilitado from financeiro.sso_vinculo_servico_mediado_gate where id), true,
 'financeiro.sso_vinculo_servico_mediado_gate aberta');

-- O inventário continua do mesmo tamanho: gate novo que nasça fechado em Financeiro ou Comercial
-- quebra aqui, e a decisão de abrir (ou não) passa a ser explícita em vez de silenciosa.
select is(
 (select count(*) from information_schema.tables t
   where t.table_schema in ('financeiro','comercial') and t.table_name like 'sso\_%\_gate'),
 72::bigint,
 'Financeiro e Comercial seguem com 72 travas catalogadas');

-- RLS enable + force continua valendo em todas elas.
select is(
 (select count(*) from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('financeiro','comercial') and c.relname like 'sso\_%\_gate'
    and c.relrowsecurity and c.relforcerowsecurity),
 72::bigint,
 'todas as travas seguem com RLS enable + force');

select * from finish();
rollback;
