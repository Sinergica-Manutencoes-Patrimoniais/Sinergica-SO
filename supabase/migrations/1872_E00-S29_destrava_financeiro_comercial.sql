-- E00-S29: abre as 72 travas de banco do Financeiro (faturáveis) e do Comercial
-- (orçamento operacional) para a rodada de exploração do cliente.
--
-- AUTORIZAÇÃO: Lucas, 25/11/2026, decisão explícita de abrir TUDO de uma vez ("pode destravar os
-- gates também para começarmos a explorar"), com o cliente ainda não operando o sistema. Mesma
-- rodada do E00-S28, que abriu as travas do PCM e declarou as flags daquele módulo.
--
-- O QUE ESTA MIGRATION FAZ, E SÓ ISSO
-- "update ... set <coluna do gate> = true" na única linha de cada tabela "*_gate". Nenhum schema
-- muda, nenhuma função é criada ou alterada, nenhum dado de negócio é tocado. O reverso é o
-- mesmo update com "false", a qualquer momento, sem deploy de código.
--
-- POR QUE MIGRATION E NÃO SQL MANUAL EM PRODUÇÃO
-- As travas do PCM foram abertas à mão no console em 24/11. Funciona, mas deixa o banco local e o
-- de CI diferentes de produção, e o próximo "db reset" volta tudo fechado sem ninguém perceber.
-- Versionada, a abertura é reproduzível, testada em CI (supabase/tests/E00-S29_*.test.sql) e
-- auditável no git.
--
-- DUAS FORMAS DE GATE, PORQUE O SCHEMA TEM DUAS
-- 69 gates são "id + habilitado". 3 são "id + leitura + escrita", porque separam quem pode
-- consultar de quem pode gravar (comercial.sso_classificacao_mediada_gate, comercial.sso_excecao_preco_mediada_gate, financeiro.sso_correcao_faturavel_mediada_gate).
-- Nesses três as duas colunas abrem: abrir só a leitura entrega tela que mostra e recusa gravar,
-- que é pior para explorar do que não ter a tela.
--
-- TRÊS DELAS NÃO SÃO "LIGAR FEATURE" — SÃO APERTAR GUARDA
-- financeiro.sso_guarda_reconciliacao_material_gate: aberta, reconhecer linha de material passa a
--   exigir revisão prévia quando já existe reconciliação do mesmo material
--   (23514 reconciliacao_exige_revisao_nao_faturavel).
-- financeiro.sso_exigir_autorizacao_complemento_gate: aberta, conferir complemento passa a exigir
--   autorização válida em vez de aceitar direto.
-- comercial.sso_guarda_fonte_retificada_gate: aberta, a transição da proposta recusa fonte de
--   aquisição sem fotografia corrente (23514 fonte_sem_fotografia_exige_recomposicao).
-- Abrem junto de propósito: a guarda existe para proteger exatamente a jornada que está sendo
-- ligada, e jornada aberta com guarda fechada é o estado inseguro. Se alguma atrapalhar a
-- exploração, fechar só ela é um update de uma linha.
--
-- O QUE NÃO VEM JUNTO
-- Concessão de capacidade não é gate: faturavel.efetivar, custo.ler, orcamento.emitir,
-- orcamento.dispensar e orcamento.excecao_preco continuam sendo concedidas por
-- config.sso_definir_concessao (Config → Capacidades). As 25 ações do catálogo foram concedidas ao
-- administrador em 24/11, na rodada do E00-S28. Ser superadmin NÃO dispensa concessão.
--
-- TUDO DENTRO DE UM ÚNICO "do": a GitHub Integration do Supabase roda cada statement fora de
-- transação (achado do deploy da 1842). Um bloco "do" é um statement — ou abre tudo, ou nada.
do $destrava$
declare
 v_tabela text;
 v_abertas integer := 0;
 v_nesta_linha integer;
 v_ausentes text[] := '{}';
 v_simples text[] := array[
  -- Financeiro — faturáveis, conferência de serviço e material, documentos, cobrança por OS (41)
  'financeiro.sso_alocacao_documento_mediada_gate',
  'financeiro.sso_anexo_faturavel_gate',
  'financeiro.sso_atestacao_servico_gate',
  'financeiro.sso_autorizacao_complemento_gate',
  'financeiro.sso_candidato_linha_gate',
  'financeiro.sso_candidato_servico_gate',
  'financeiro.sso_cobranca_os_gate',
  'financeiro.sso_comandos_servico_extra_mediado_gate',
  'financeiro.sso_conferencia_candidato_servico_gate',
  'financeiro.sso_conferencia_origem_gate',
  'financeiro.sso_coordenacao_linhas_gate',
  'financeiro.sso_documento_cobranca_gate',
  'financeiro.sso_documento_interno_gate',
  'financeiro.sso_exigir_autorizacao_complemento_gate',
  'financeiro.sso_fato_execucao_declarado_gate',
  'financeiro.sso_faturamento_gate',
  'financeiro.sso_filtro_faturaveis_gate',
  'financeiro.sso_guarda_reconciliacao_material_gate',
  'financeiro.sso_historico_faturavel_todas_origens_gate',
  'financeiro.sso_identificar_fato_mediado_gate',
  'financeiro.sso_leitura_fato_servico_gate',
  'financeiro.sso_leituras_faturaveis_gate',
  'financeiro.sso_material_declaracao_gate',
  'financeiro.sso_modo_faturamento_gate',
  'financeiro.sso_parcela_adicional_gate',
  'financeiro.sso_previa_origem_servico_gate',
  'financeiro.sso_proposta_faturavel_gate',
  'financeiro.sso_reconciliacao_mediada_gate',
  'financeiro.sso_reconciliacao_servico_material_gate',
  'financeiro.sso_recuperar_parcela_gate',
  'financeiro.sso_relatorio_despesas_mediado_gate',
  'financeiro.sso_repasse_despesa_gate',
  'financeiro.sso_reserva_documento_liberacao_gate',
  'financeiro.sso_revisao_origens_reconciliacao_gate',
  'financeiro.sso_revogacao_autorizacao_complemento_gate',
  'financeiro.sso_selecao_documento_gate',
  'financeiro.sso_servico_extra_gate',
  'financeiro.sso_snapshot_servico_extra_gate',
  'financeiro.sso_snapshot_servico_mediado_gate',
  'financeiro.sso_vinculo_resposta_servico_gate',
  'financeiro.sso_vinculo_servico_mediado_gate',
  -- Comercial — orçamento operacional, fontes de aquisição, exceção de preço, assessment (28)
  'comercial.sso_assessment_cliente_gate',
  'comercial.sso_classificacao_linha_gate',
  'comercial.sso_composicao_mista_gate',
  'comercial.sso_composicao_parcelas_gate',
  'comercial.sso_consulta_parcelas_orcamento_gate',
  'comercial.sso_correlacao_gasto_gate',
  'comercial.sso_correlacao_mediada_gate',
  'comercial.sso_decisao_correlacao_gate',
  'comercial.sso_decisao_pcm_orcamento_gate',
  'comercial.sso_dispensa_orcamento_gate',
  'comercial.sso_escrita_assessment_gate',
  'comercial.sso_excecao_preco_gate',
  'comercial.sso_exportacao_operacional_gate',
  'comercial.sso_fonte_aquisicao_gate',
  'comercial.sso_guarda_fonte_retificada_gate',
  'comercial.sso_historico_fontes_orcamento_gate',
  'comercial.sso_historico_legado_operacional_gate',
  'comercial.sso_historico_legado_pre_os_gate',
  'comercial.sso_inventario_assessment_gate',
  'comercial.sso_itens_publicos_gate',
  'comercial.sso_orcamento_operacional_gate',
  'comercial.sso_origem_operacional_gate',
  'comercial.sso_painel_operacional_gate',
  'comercial.sso_retificacao_classificacao_gate',
  'comercial.sso_retificacao_fonte_aquisicao_gate',
  'comercial.sso_retificacao_fonte_utilizada_gate',
  'comercial.sso_vinculo_assessment_gate',
  'comercial.sso_visibilidade_orcamento_gate'
 ];
 v_leitura_escrita text[] := array[
  'comercial.sso_classificacao_mediada_gate',
  'comercial.sso_excecao_preco_mediada_gate',
  'financeiro.sso_correcao_faturavel_mediada_gate'
 ];
begin
 foreach v_tabela in array v_simples loop
  -- Tabela ausente não é erro: feature removida ou renomeada não pode derrubar a abertura das
  -- outras. Fica registrado no aviso final.
  if pg_catalog.to_regclass(v_tabela) is null then
   v_ausentes := v_ausentes || v_tabela;
   continue;
  end if;
  -- Idempotente: reaplicar não é erro, só não conta de novo (o "not habilitado" filtra).
  execute pg_catalog.format('update %s set habilitado = true where id and not habilitado', v_tabela);
  get diagnostics v_nesta_linha = row_count;
  v_abertas := v_abertas + v_nesta_linha;
 end loop;

 foreach v_tabela in array v_leitura_escrita loop
  if pg_catalog.to_regclass(v_tabela) is null then
   v_ausentes := v_ausentes || v_tabela;
   continue;
  end if;
  execute pg_catalog.format(
   'update %s set leitura = true, escrita = true where id and not (leitura and escrita)', v_tabela);
  get diagnostics v_nesta_linha = row_count;
  v_abertas := v_abertas + v_nesta_linha;
 end loop;

 raise notice 'E00-S29: % trava(s) alvo, % aberta(s) nesta execução, % ausente(s): %',
  array_length(v_simples, 1) + array_length(v_leitura_escrita, 1),
  v_abertas,
  coalesce(array_length(v_ausentes, 1), 0),
  coalesce(array_to_string(v_ausentes, ', '), 'nenhuma');
end
$destrava$;
