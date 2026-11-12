-- E01 (varredura transversal) — correção do terceiro pilar de ativação de feature.
--
-- Achado em 2026-11-12 cruzando TODA chamada `.rpc("...")` de apps/web com os privilégios reais
-- do banco: 333 RPCs chamadas por componentes VIVOS da UI (ex.: OrdemServicoDetalheDrawer,
-- Composicoes, Workspace) não tinham `execute` para `authenticated` em nenhuma migration.
--
-- Ativar uma feature do SSO exige TRÊS peças: flag no front + gate no banco + grant de execute.
-- As duas primeiras são gerenciadas e documentadas; a terceira faltava. Consequência real: ao
-- abrir um gate em produção para homologar, a feature falharia com 42501 mesmo com o gate aberto
-- — o gate abriria para uma função que ninguém pode executar.
--
-- Esta migration concede execute APENAS nas funções que comprovadamente checam um `_gate` ANTES
-- de qualquer escrita (verificado função a função sobre pg_get_functiondef no banco já migrado).
-- Enquanto os gates seguirem fechados — e nenhuma migration desta branch abre gate algum
-- (581 gates, 0 abertos) — o efeito é inerte: a chamada passa a responder "feature desabilitada"
-- (55000) ou a recusa de autorização da própria função, em vez de "permission denied" (42501),
-- sem nenhuma escrita.
--
-- Deliberadamente FORA desta migration:
--   * 49 funções de leitura sem gate — sem trava própria, decisão caso a caso;
--   * 7 que escrevem sem gate (sso_criar_orcamento_operacional, sso_criar_grupo_atomico,
--     sso_editar_grupo_idempotente, sso_declarar_repasse_despesa, sso_publicar_cobranca_os,
--     sso_alterar_previsao_visita, sso_ratear_despesa_visita) — todas com autorização real, mas
--     sem gate não haveria como desfazer a ativação sem novo deploy;
--   * os núcleos/mediadores que a própria suíte exige privados enquanto aguardam rollout
--     coordenado (E01-S166_S177_rollout_acl.test.sql, E01-S168_funcoes_t24_permissoes.test.sql,
--     e os asserts `not has_function_privilege('authenticated', ...)` espalhados pela suíte).
--
-- Autorização conferida: todas checam `sso_autorizar_acao`, `auth.uid()` ou papel no JWT; as duas
-- que delegam (sso_previa_revisao_fila, sso_portal_itens_publicos_historico) foram lidas
-- individualmente e validam tenant via helper.

grant execute on function comercial.sso_condicoes_excecao_preco(p_proposta_id uuid) to authenticated;
grant execute on function comercial.sso_consultar_decisao_pcm_orcamento(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer) to authenticated;
grant execute on function comercial.sso_consultar_retificacao_classificacao(p_cliente_id uuid, p_classificacao_id uuid) to authenticated;
grant execute on function comercial.sso_consultar_visibilidade_orcamento(p_proposta_id uuid, p_versao integer) to authenticated;
grant execute on function comercial.sso_criar_orcamento_sem_oportunidade(p_request_id uuid, p_lista_id uuid, p_lista_revision integer) to authenticated;
grant execute on function comercial.sso_decidir_orcamento_pcm(p_request_id uuid, p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer, p_decisao text, p_motivo text, p_evidencia text) to authenticated;
grant execute on function comercial.sso_listar_fontes_orcamento(p_ator_id uuid, p_cliente_id uuid, p_proposta_id uuid, p_versao integer, p_apos integer, p_limite integer) to authenticated;
grant execute on function comercial.sso_listar_historico_orcamento_legado_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function comercial.sso_listar_historico_orcamento_pre_os(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function comercial.sso_listar_parcelas_orcamento(p_ator_id uuid, p_cliente_id uuid, p_lista_id uuid, p_apos_despesa uuid, p_apos_vinculo uuid, p_limite integer) to authenticated;
grant execute on function comercial.sso_painel_propostas_operacionais(p_inicio date, p_fim date, p_apos uuid) to authenticated;
grant execute on function comercial.sso_portal_decidir_proposta_versionada(p_request_id uuid, p_proposta_id uuid, p_versao integer, p_decisao text, p_motivo text) to authenticated;
grant execute on function comercial.sso_portal_detalhe_operacional(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer) to authenticated;
grant execute on function comercial.sso_portal_itens_publicos(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer) to authenticated;
grant execute on function comercial.sso_portal_itens_publicos_historico(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer) to authenticated;
grant execute on function comercial.sso_portal_propostas_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid) to authenticated;
grant execute on function comercial.sso_preparar_orcamento_operacional(p_request_id uuid, p_proposta_id uuid, p_expected_revision integer, p_lista_id uuid, p_lista_revision integer, p_descricao text, p_custo_aquisicao_centavos bigint, p_custos_operacionais_centavos bigint, p_fator numeric, p_preco_centavos bigint) to authenticated;
grant execute on function comercial.sso_preparar_orcamento_parcelas(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_proposta_id uuid, p_expected_revision integer, p_lista_id uuid, p_lista_revision integer, p_descricao text, p_fontes jsonb, p_fator numeric, p_preco_centavos bigint) to authenticated;
grant execute on function comercial.sso_publicar_orcamento_itens(p_request_id uuid, p_proposta_id uuid, p_versao integer, p_escopo text, p_descricao text, p_itens jsonb) to authenticated;
grant execute on function comercial.sso_transicionar_orcamento_sem_oportunidade(p_request_id uuid, p_proposta_id uuid, p_versao integer, p_estado_esperado text, p_acao text, p_escopo_publico text, p_descricao_publica text) to authenticated;
grant execute on function comercial.sso_vincular_assessment(p_ator_id uuid, p_cliente_id uuid, p_proposta_id uuid, p_inspecao_id uuid) to authenticated;
grant execute on function comercial.sso_visibilidade_orcamento(p_request_id uuid, p_proposta_id uuid, p_versao integer, p_acao text, p_motivo text) to authenticated;
grant execute on function financeiro.sso_alocar_parcela_adicional(p_request_id uuid, p_alocacao_id uuid, p_cliente_id uuid, p_item_id uuid, p_expected_revision integer, p_documento_id uuid, p_valor_centavos bigint) to authenticated;
grant execute on function financeiro.sso_anexos_publicados_para_cobranca(p_cliente_id uuid, p_lancamento_id uuid, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_autorizar_complemento_interno(p_request_id uuid, p_cliente_id uuid, p_item_id uuid, p_expected_revision integer, p_motivo text) to authenticated;
grant execute on function financeiro.sso_conferir_datas_documentos(p_cliente_id uuid, p_competencia date, p_apos uuid, p_limite integer) to authenticated;
grant execute on function financeiro.sso_conferir_estorno_faturavel(p_request_id uuid, p_conferencia_id uuid, p_estorno_id uuid, p_saida_id uuid, p_referencia text, p_motivo text) to authenticated;
grant execute on function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid, p_item_id uuid, p_expected_revision integer, p_acao text, p_valor_centavos bigint, p_motivo text) to authenticated;
grant execute on function financeiro.sso_consultar_modo_proposta(p_cliente_id uuid, p_proposta_id uuid) to authenticated;
grant execute on function financeiro.sso_contexto_documento_interno(p_cliente_id uuid, p_item_id uuid) to authenticated;
grant execute on function financeiro.sso_corrigir_modo_proposta(p_request_id uuid, p_cliente_id uuid, p_proposta_id uuid, p_revisao integer, p_modo text, p_motivo text) to authenticated;
grant execute on function financeiro.sso_declarar_material_fornecido(p_request_id uuid, p_declaracao_id uuid, p_cliente_id uuid, p_lista_id uuid, p_lista_revisao integer, p_descricao text, p_evidencia text) to authenticated;
grant execute on function financeiro.sso_definir_modo_proposta(p_request_id uuid, p_cliente_id uuid, p_proposta_id uuid, p_modo text, p_motivo text) to authenticated;
grant execute on function financeiro.sso_diagnostico_aceite_complemento(p_cliente_id uuid, p_item_id uuid) to authenticated;
grant execute on function financeiro.sso_diagnostico_documentos_competencia(p_cliente_id uuid, p_competencia date, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_diagnostico_origem_os_faturavel(p_cliente_id uuid, p_os_id uuid) to authenticated;
grant execute on function financeiro.sso_documentos_competencia(p_cliente_id uuid, p_competencia date, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_historico_autorizacao_complemento(p_cliente_id uuid, p_proposta_id uuid, p_item_id uuid, p_antes timestamp with time zone, p_antes_id uuid, p_limite integer) to authenticated;
grant execute on function financeiro.sso_historico_documentos_cobranca(p_cliente_id uuid, p_lancamento_id uuid, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_historico_documentos_faturavel(p_item_id uuid, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_historico_documentos_internos(p_cliente_id uuid, p_item_id uuid, p_antes timestamp with time zone, p_antes_id uuid, p_limite integer) to authenticated;
grant execute on function financeiro.sso_historico_revisao_faturavel(p_cliente_id uuid, p_item_id uuid, p_apos integer) to authenticated;
grant execute on function financeiro.sso_linhas_material_proposta(p_cliente_id uuid, p_declaracao_id uuid) to authenticated;
grant execute on function financeiro.sso_listar_complementos_comercial(p_cliente_id uuid, p_proposta_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function financeiro.sso_listar_comprovantes_faturavel(p_cliente_id uuid, p_item_id uuid, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_listar_declaracoes_material(p_cliente_id uuid, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_listar_pedidos_alocacao_proprios(p_cliente_id uuid, p_item_id uuid, p_antes timestamp with time zone, p_antes_id uuid, p_limite integer) to authenticated;
grant execute on function financeiro.sso_portal_documentos_cobranca(p_cliente_id uuid, p_os_id uuid, p_lancamento_id uuid, p_apos uuid) to authenticated;
grant execute on function financeiro.sso_previa_impedimentos_parcela(p_cliente_id uuid, p_item_id uuid, p_documento_id uuid, p_revisao integer, p_valor_centavos bigint) to authenticated;
grant execute on function financeiro.sso_previa_parcela_documento(p_cliente_id uuid, p_item_id uuid, p_lancamento_id uuid) to authenticated;
grant execute on function financeiro.sso_publicar_documento_cobranca_v2(p_request_id uuid, p_cobranca_id uuid, p_anexo_id uuid) to authenticated;
grant execute on function financeiro.sso_rastrear_candidato_linha(p_cliente_id uuid, p_item_id uuid) to authenticated;
grant execute on function financeiro.sso_reconhecer_linha_material(p_request_id uuid, p_cliente_id uuid, p_declaracao_id uuid, p_quantidade integer, p_preco_unitario bigint, p_competencia date) to authenticated;
grant execute on function financeiro.sso_reconhecer_proposta_com_fechamento(p_request_id uuid, p_cliente_id uuid, p_proposta_id uuid, p_versao integer, p_valor_centavos bigint, p_competencia date) to authenticated;
grant execute on function financeiro.sso_recuperar_parcela_adicional(p_cliente_id uuid, p_item_id uuid, p_request_id uuid) to authenticated;
grant execute on function financeiro.sso_relatorio_alocacao_pagamento(p_cliente_id uuid, p_competencia date) to authenticated;
grant execute on function financeiro.sso_retira_documento_cobranca(p_vinculo_id uuid, p_motivo text) to authenticated;
grant execute on function financeiro.sso_revisar_material_fornecido(p_request_id uuid, p_declaracao_id uuid, p_revisao integer, p_decisao text, p_motivo text) to authenticated;
grant execute on function financeiro.sso_revogar_autorizacao_complemento(p_request_id uuid, p_cliente_id uuid, p_autorizacao_id uuid, p_expected_revision integer, p_motivo text) to authenticated;
grant execute on function financeiro.sso_saldo_documento_interno(p_cliente_id uuid, p_item_id uuid) to authenticated;
grant execute on function financeiro.sso_vincular_comprovante_faturavel(p_item_id uuid, p_revisao integer) to authenticated;
grant execute on function financeiro.sso_vincular_material_linha(p_request_id uuid, p_cliente_id uuid, p_declaracao_id uuid, p_linha_id uuid, p_quantidade integer, p_preco_unitario bigint, p_justificativa text) to authenticated;
grant execute on function financeiro.sso_vincular_material_proposta(p_request_id uuid, p_declaracao_id uuid, p_cliente_id uuid, p_proposta_id uuid, p_versao integer, p_motivo text) to authenticated;
grant execute on function pcm.sso_acoes_locais_fila(p_cliente_id uuid, p_outbox_id uuid) to authenticated;
grant execute on function pcm.sso_alterar_dia_contratual(p_request_id uuid, p_serie_id uuid, p_regra_nova_id uuid, p_expected_revision integer, p_dia_semana integer, p_vigencia date) to authenticated;
grant execute on function pcm.sso_anexos_os_para_publicacao(p_cliente_id uuid, p_os_id uuid, p_apos uuid) to authenticated;
grant execute on function pcm.sso_anotar_excecao_material(p_request_id uuid, p_lista_id uuid, p_expected_revision integer, p_evento_revision integer, p_texto text) to authenticated;
grant execute on function pcm.sso_anotar_os_reconciliacao(p_request_id uuid, p_cliente_id uuid, p_os_id uuid, p_updated_at timestamp with time zone, p_sync text, p_task_id text, p_nota text) to authenticated;
grant execute on function pcm.sso_anotar_outbox_reconciliacao(p_request_id uuid, p_cliente_id uuid, p_outbox_id uuid, p_status_esperado text, p_tentativas_esperadas integer, p_observacao text) to authenticated;
grant execute on function pcm.sso_anotar_sync_funcionario_visita(p_request_id uuid, p_cliente_id uuid, p_visita_id uuid, p_revisao_visita integer, p_outbox_id uuid, p_estado text, p_tentativas integer, p_observacao text) to authenticated;
grant execute on function pcm.sso_aprovar_continuacao_chamado(p_request_id uuid, p_request_criar_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint, p_proposta_id uuid, p_nova_os_id uuid) to authenticated;
grant execute on function pcm.sso_atender_parcela_revisada(p_request_id uuid, p_parcela_id uuid, p_os_id uuid, p_chamado_revision bigint, p_escopo_revision bigint, p_revisao_humana integer, p_confirma boolean, p_motivo text) to authenticated;
grant execute on function pcm.sso_atribuicao_tecnico_despesa(p_despesa_id uuid) to authenticated;
grant execute on function pcm.sso_atribuir_criticidade_pendencia(p_request_id uuid, p_pendencia_id uuid, p_revision integer, p_criticidade text, p_motivo text) to authenticated;
grant execute on function pcm.sso_atribuir_parcela_ciclo(p_request_id uuid, p_ator_esperado uuid, p_cliente_id uuid, p_ciclo_id uuid, p_parcela_id uuid, p_os_id uuid, p_chamado_revision bigint, p_escopo_revision bigint, p_os_status text, p_os_atualizada_em timestamp with time zone, p_motivo text) to authenticated;
grant execute on function pcm.sso_atribuir_parcela_os(p_request_id uuid, p_parcela_id uuid, p_os_id uuid, p_chamado_revision bigint, p_escopo_revision bigint, p_os_status text, p_os_atualizada_em timestamp with time zone, p_motivo text) to authenticated;
grant execute on function pcm.sso_atribuir_tecnico_despesa(p_request_id uuid, p_despesa_id uuid, p_expected_revision integer, p_participacao_id uuid, p_motivo text) to authenticated;
grant execute on function pcm.sso_atualizar_pesos_gutd(p_request_id uuid, p_antes jsonb, p_g integer, p_u integer, p_t integer, p_d integer, p_motivo text) to authenticated;
grant execute on function pcm.sso_avaliar_encerramento_chamado(p_cliente_id uuid, p_chamado_id uuid) to authenticated;
grant execute on function pcm.sso_avaliar_evidencia_os(p_request_id uuid, p_cliente_id uuid, p_os_id uuid, p_evidencia_id uuid, p_revisao integer, p_versao_local timestamp with time zone, p_decisao text, p_motivo text) to authenticated;
grant execute on function pcm.sso_bloqueios_intencao_local(p_cliente_id uuid, p_visita_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_buscar_codigo_grupo_staging(p_cliente_id uuid, p_codigo text, p_apos_lote uuid, p_apos_chave text, p_limite integer) to authenticated;
grant execute on function pcm.sso_cancelar_chamado_conservador(p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint, p_motivo text) to authenticated;
grant execute on function pcm.sso_candidatos_ciclos_posteriores(p_cliente_id uuid, p_composicao_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_candidatos_devolucao_ciclo(p_cliente_id uuid, p_composicao_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_comando_escopo_chamado(p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint, p_acao text, p_item_id uuid, p_descricao text, p_os_id uuid, p_minutos integer) to authenticated;
grant execute on function pcm.sso_compor_backlog_pendencias(p_request_id uuid, p_cliente_id uuid, p_itens jsonb) to authenticated;
grant execute on function pcm.sso_conferir_composicao_visita(p_request_id uuid, p_cliente_id uuid, p_visita_id uuid, p_revisao integer, p_snapshot jsonb) to authenticated;
grant execute on function pcm.sso_conferir_confirmacao_cliente_visita(p_visita_id uuid) to authenticated;
grant execute on function pcm.sso_conferir_conteudo_os(p_request_id uuid, p_cliente_id uuid, p_visita_id uuid, p_os_id uuid, p_visita_revision integer, p_geracao bigint, p_snapshot jsonb) to authenticated;
grant execute on function pcm.sso_conferir_continuacao_devolvida(p_ator_id uuid, p_cliente_id uuid, p_retorno_id uuid) to authenticated;
grant execute on function pcm.sso_conferir_despesa_visita(p_cliente_id uuid, p_visita_id uuid, p_despesa_id uuid) to authenticated;
grant execute on function pcm.sso_conferir_tolerancias_lote(p_ator_id uuid, p_cliente_id uuid, p_lote_id uuid, p_expected_revision integer, p_mapeamentos uuid[]) to authenticated;
grant execute on function pcm.sso_configurar_politica_equipment(p_ator_id uuid, p_request_id uuid, p_categoria_id uuid, p_revisao integer, p_controlado boolean, p_motivo text) to authenticated;
grant execute on function pcm.sso_confirmar_retorno_propriedade_os(p_request_id uuid, p_ator_id uuid, p_cliente_id uuid, p_os_id uuid, p_revisao integer, p_motivo text) to authenticated;
grant execute on function pcm.sso_consultar_atendimento_parcela_revisada(p_parcela_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_categoria_componente(p_ator_id uuid, p_cliente_id uuid, p_componente_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_codigo_atual_mediado(p_ator_id uuid, p_cliente_id uuid, p_tipo text, p_ativo_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_composicao_backlog(p_cliente_id uuid, p_composicao_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_condicao_resolucao(p_pendencia_id uuid, p_revision integer) to authenticated;
grant execute on function pcm.sso_consultar_destino_documento_ativo(p_documento_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_escopo_chamado_preparado(p_cliente_id uuid, p_chamado_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_evidencias_uso_codigo(p_ator_id uuid, p_cliente_id uuid, p_tipo text, p_ativo_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_impedimento_suspensao(p_chamado_id uuid, p_revision integer) to authenticated;
grant execute on function pcm.sso_consultar_inicio_processamento(p_ator_id uuid, p_cliente_id uuid, p_outbox_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_lote_recebido(p_ator_id uuid, p_cliente_id uuid, p_lote_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_reabertura_chamado(p_cliente_id uuid, p_chamado_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_realizacao_despesa(p_ator_id uuid, p_cliente_id uuid, p_visita_id uuid, p_despesa_id uuid, p_request_id uuid, p_revision integer, p_valor bigint, p_objeto_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_reconciliacao_parcela(p_parcela_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_retirada_composicao(p_composicao_id uuid) to authenticated;
grant execute on function pcm.sso_consultar_retorno_parcial(p_cliente_id uuid, p_ciclo_id uuid, p_proposta_id uuid) to authenticated;
grant execute on function pcm.sso_contar_orfaos_fila_admin() to authenticated;
grant execute on function pcm.sso_contexto_anexo_localizacao(p_tipo text, p_anexo_id uuid) to authenticated;
grant execute on function pcm.sso_corrigir_despesa_realizada(p_request_id uuid, p_despesa_id uuid, p_expected_revision integer, p_acao text, p_data date, p_descricao text, p_motivo text, p_conferencia_financeira text) to authenticated;
grant execute on function pcm.sso_corrigir_realizacao_despesa(p_request_id uuid, p_despesa_id uuid, p_expected_revision integer, p_valor_centavos bigint, p_comprovante_objeto_id uuid, p_motivo text, p_conferencia_financeira text) to authenticated;
grant execute on function pcm.sso_criticidade_pendencias_alvo(p_cliente_id uuid, p_tipo text, p_alvo_id uuid) to authenticated;
grant execute on function pcm.sso_cronologia_evidencia_linha(p_tipo text, p_anexo_id uuid) to authenticated;
grant execute on function pcm.sso_decidir_codigo_grupo_pendente(p_request_id uuid, p_lote_id uuid, p_expected_revision integer, p_chave text, p_atributos jsonb, p_motivo text, p_confirmado boolean) to authenticated;
grant execute on function pcm.sso_decidir_feriado_declarado(p_request_id uuid, p_cliente_id uuid, p_feriado_id uuid, p_expected_revision integer, p_acao text, p_contrato_id uuid, p_data date, p_fonte text, p_motivo text) to authenticated;
grant execute on function pcm.sso_decidir_feriado_mediado(p_ator_id uuid, p_request_id uuid, p_cliente_id uuid, p_feriado_id uuid, p_expected_revision integer, p_acao text, p_contrato_id uuid, p_data date, p_fonte text, p_motivo text) to authenticated;
grant execute on function pcm.sso_decidir_pendencia(p_request_id uuid, p_pendencia_id uuid, p_revision integer, p_decisao text, p_motivo text) to authenticated;
grant execute on function pcm.sso_decisao_foto_origem_pendencia(p_pendencia_id uuid, p_evidencia_id uuid) to authenticated;
grant execute on function pcm.sso_declarar_evidencia_os_manual(p_request_id uuid, p_cliente_id uuid, p_os_id uuid, p_updated_at timestamp with time zone, p_sync text, p_task_id text, p_nota text, p_resultado text, p_origem text, p_referencia text) to authenticated;
grant execute on function pcm.sso_declarar_interrupcao_ciclo(p_request_id uuid, p_ator_esperado uuid, p_cliente_id uuid, p_ciclo_id uuid, p_parcela_id uuid, p_os_id uuid, p_escopo_revision bigint, p_suspensao_revision integer, p_expected_revision integer, p_estado text, p_motivo text) to authenticated;
grant execute on function pcm.sso_declarar_interrupcao_parcela(p_request_id uuid, p_parcela_id uuid, p_os_id uuid, p_escopo_revision bigint, p_suspensao_revision integer, p_expected_revision integer, p_estado text, p_motivo text) to authenticated;
grant execute on function pcm.sso_declarar_intervalo_capacidade(p_request_id uuid, p_intervalo_id uuid, p_disponibilidade_id uuid, p_expected_revision integer, p_tipo text, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_fuso text, p_referencia text) to authenticated;
grant execute on function pcm.sso_diagnosticar_aptidao_continuacao_devolvida(p_ator_id uuid, p_cliente_id uuid, p_chamado_id uuid) to authenticated;
grant execute on function pcm.sso_diagnosticar_codigos_grupo(p_lote_id uuid, p_apos text, p_limite integer) to authenticated;
grant execute on function pcm.sso_diagnosticar_colisoes_legadas(p_cliente_id uuid) to authenticated;
grant execute on function pcm.sso_diagnosticar_conflitos_capacidade(p_disponibilidade_id uuid) to authenticated;
grant execute on function pcm.sso_diagnosticar_conflitos_interclientes(p_disponibilidade_id uuid) to authenticated;
grant execute on function pcm.sso_diagnosticar_hierarquia_lote(p_cliente_id uuid, p_lote_id uuid, p_revision integer, p_apos text, p_limite integer) to authenticated;
grant execute on function pcm.sso_diagnostico_ancestrais_grupos(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_diagnostico_conteudo_os(p_cliente_id uuid, p_visita_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_diagnostico_devolucao_parcial(p_composicao_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_diagnostico_falha_fila(p_cliente_id uuid, p_outbox_id uuid) to authenticated;
grant execute on function pcm.sso_diagnostico_inconsistencias_fila(p_cliente_id uuid) to authenticated;
grant execute on function pcm.sso_diagnostico_resolucao_pendencia(p_pendencia_id uuid) to authenticated;
grant execute on function pcm.sso_diagnostico_sincronizacao_visita(p_cliente_id uuid, p_visita_id uuid) to authenticated;
grant execute on function pcm.sso_diagnostico_snapshot_os(p_cliente_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_diagnostico_vinculos_grupos(p_cliente_id uuid) to authenticated;
grant execute on function pcm.sso_dividir_composicao_backlog(p_request_id uuid, p_cliente_id uuid, p_origem_id uuid, p_expected_revision integer, p_destino_id uuid, p_itens jsonb, p_motivo text) to authenticated;
grant execute on function pcm.sso_estatisticas_notas_triagem(p_cliente_id uuid) to authenticated;
grant execute on function pcm.sso_filtrar_contexto_pendencias(p_cliente_id uuid, p_norma_filtro text, p_condicao_filtro text, p_norma_valor text, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_filtrar_criticidade_pendencias(p_cliente_id uuid, p_filtro text, p_valor text, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_fotografia_escopo_conversao(p_cliente_id uuid, p_chamado_id uuid) to authenticated;
grant execute on function pcm.sso_fotografia_feriados(p_ator_id uuid, p_cliente_id uuid, p_contrato_id uuid, p_inicio date, p_fim date, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_gutd_parcela(p_parcela_id uuid) to authenticated;
grant execute on function pcm.sso_historico_avaliacao_os(p_cliente_id uuid, p_os_id uuid, p_evidencia_id uuid) to authenticated;
grant execute on function pcm.sso_historico_cadastro_levantamentos(p_cliente_id uuid, p_tipo text, p_entidade_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_codigo_grupo_pendente(p_lote_id uuid, p_chave text, p_apos integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_composicao_vazia_vinculada(p_composicao_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_observacao_origem(p_ator_id uuid, p_cliente_id uuid, p_tipo text, p_objeto_id uuid, p_apos integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_pesos_gutd(p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_rateio_despesa(p_cliente_id uuid, p_visita_id uuid, p_despesa_id uuid, p_apos integer) to authenticated;
grant execute on function pcm.sso_historico_remocao_caracteristica(p_cliente_id uuid, p_grupo_id uuid, p_apos integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_resolucao_ativo(p_cliente_id uuid, p_alvo_tipo text, p_alvo_id uuid, p_antes timestamp with time zone, p_antes_id uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_selecao_composicao(p_composicao_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_sync_funcionario_visita(p_cliente_id uuid, p_visita_id uuid, p_outbox_id uuid, p_apos timestamp with time zone, p_apos_id uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_historico_vinculo_os_rotina(p_cliente_id uuid, p_os_id uuid, p_apos integer) to authenticated;
grant execute on function pcm.sso_horizonte_capacidade_preparado(p_cliente_id uuid, p_semana_inicio date, p_quantidade integer) to authenticated;
grant execute on function pcm.sso_impacto_execucao_grupo(p_grupo_id uuid) to authenticated;
grant execute on function pcm.sso_impacto_rotinas_grupo(p_grupo_id uuid) to authenticated;
grant execute on function pcm.sso_inbox_os_situacao_incerta(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_inventario_coincidencias_fila(p_cliente_id uuid) to authenticated;
grant execute on function pcm.sso_listar_anexos_localizacao_atualizada(p_cliente_id uuid, p_tipo_localizacao text, p_entidade_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_avaliacoes_os(p_cliente_id uuid, p_os_id uuid, p_evidencia_id uuid, p_antes integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_categorias_mapeamento(p_ator_id uuid, p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_coincidencias_calendario_feriado(p_ator_id uuid, p_cliente_id uuid, p_feriado_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_composicoes_vazias_vinculadas(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_contexto_pendencia(p_pendencia_id uuid, p_apos integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_criticidade_pendencia(p_pendencia_id uuid, p_apos integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_decisoes_onda(p_cliente_id uuid, p_onda smallint, p_antes timestamp with time zone, p_antes_id uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_escopo_evidencias(p_composicao_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_evidencias_onda(p_cliente_id uuid, p_onda smallint, p_apos integer, p_revisao integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_evidencias_origem_pendencia(p_pendencia_id uuid, p_antes integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_evidencias_os_manual(p_cliente_id uuid, p_os_id uuid, p_apos timestamp with time zone, p_apos_id uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_evidencias_resolucao(p_pendencia_id uuid, p_revision integer, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_feriados_declarados(p_cliente_id uuid, p_contrato_id uuid, p_inicio date, p_fim date, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_historico_suspensao(p_chamado_id uuid, p_apos integer, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_impactos_feriado_visita(p_ator_id uuid, p_cliente_id uuid, p_feriado_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_intencoes_locais(p_cliente_id uuid, p_visita_id uuid, p_request_id uuid, p_apos uuid) to authenticated;
grant execute on function pcm.sso_listar_intervalos_capacidade(p_disponibilidade_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_notas_fila_filtradas(p_cliente_id uuid, p_outbox_id uuid, p_ator uuid, p_estado text, p_tentativas integer, p_apos timestamp with time zone, p_apos_id uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_notas_os_reconciliacao(p_cliente_id uuid, p_os_id uuid, p_apos timestamp with time zone, p_apos_id uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_notas_outbox(p_cliente_id uuid, p_outbox_id uuid, p_apos timestamp with time zone, p_apos_id uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_observacoes_reserva(p_ator_id uuid, p_cliente_id uuid, p_outbox_id uuid, p_componente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_ordens_chamado_foto(p_cliente_id uuid, p_chamado_id uuid, p_limite integer, p_apos uuid, p_assinatura text) to authenticated;
grant execute on function pcm.sso_listar_origens_despesa_incompletas(p_ator_id uuid, p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_os_reconciliacao(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_outbox_reconciliacao(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_outbox_reconciliacao_filtrada(p_cliente_id uuid, p_estado text, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_pendencias_sem_condicao(p_cliente_id uuid, p_alvo_tipo text, p_alvo_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_pendencias_sem_parcela(p_composicao_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_politica_equipment(p_ator_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_processamentos_demorados(p_ator_id uuid, p_cliente_id uuid, p_minutos integer, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_publicacoes_visita(p_cliente_id uuid, p_visita_id uuid, p_os_id uuid, p_apos uuid) to authenticated;
grant execute on function pcm.sso_listar_ranking_backlog_consistente(p_cliente_id uuid, p_limite integer, p_apos_id uuid, p_apos_score numeric, p_assinatura text) to authenticated;
grant execute on function pcm.sso_listar_ranking_backlog_por_alvo(p_cliente_id uuid, p_alvo_tipo text, p_alvo_id uuid, p_limite integer, p_apos_id uuid, p_apos_score numeric, p_assinatura text) to authenticated;
grant execute on function pcm.sso_listar_reaberturas_chamado(p_cliente_id uuid, p_chamado_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_reservas_equipment(p_ator_id uuid, p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_resultados_ativo(p_cliente_id uuid, p_alvo_tipo text, p_alvo_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_retornos_ciclo(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_retornos_parciais(p_cliente_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_listar_supressoes_gerador_feriado(p_ator_id uuid, p_cliente_id uuid, p_feriado_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_mapear_categoria_componente(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_componente_id uuid, p_categoria_id uuid, p_texto_observado text, p_revisao integer, p_motivo text) to authenticated;
grant execute on function pcm.sso_metadados_exportacao_plano(p_cliente_id uuid, p_plano_id uuid, p_versao_id uuid) to authenticated;
grant execute on function pcm.sso_motivos_historico_grupo(p_grupo_id uuid, p_eventos uuid[]) to authenticated;
grant execute on function pcm.sso_observar_reserva_equipment(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_outbox_id uuid, p_componente_id uuid, p_observacao text) to authenticated;
grant execute on function pcm.sso_os_ciclo_posterior(p_cliente_id uuid, p_ciclo_id uuid, p_modo text, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_portal_calendario_visitas(p_cliente_id uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_apos_inicio timestamp with time zone, p_apos_id uuid) to authenticated;
grant execute on function pcm.sso_portal_ciente_visita(p_publicacao_id uuid) to authenticated;
grant execute on function pcm.sso_portal_comunicacao(p_cliente_id uuid, p_tipo text, p_publicacao_id uuid) to authenticated;
grant execute on function pcm.sso_portal_comunicacoes(p_cliente_id uuid, p_apos_data timestamp with time zone, p_apos_tipo text, p_apos_id uuid) to authenticated;
grant execute on function pcm.sso_portal_confirmar_visita(p_request_id uuid, p_publicacao_id uuid) to authenticated;
grant execute on function pcm.sso_portal_historico_materiais(p_cliente_id uuid, p_os_id uuid, p_lista_id uuid, p_apos integer) to authenticated;
grant execute on function pcm.sso_portal_informar_material(p_request_id uuid, p_lista_id uuid, p_expected_revision integer, p_situacao text) to authenticated;
grant execute on function pcm.sso_portal_listar_materiais(p_cliente_id uuid, p_os_id uuid, p_apos uuid) to authenticated;
grant execute on function pcm.sso_portal_listas_historico_materiais(p_cliente_id uuid, p_os_id uuid, p_apos uuid) to authenticated;
grant execute on function pcm.sso_portal_publicar_visita_v2(p_request_id uuid, p_visita_id uuid, p_os_id uuid, p_revisao integer, p_mensagem text) to authenticated;
grant execute on function pcm.sso_portal_situacao_os(p_cliente_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_portal_status_confirmacao_visita(p_publicacao_id uuid) to authenticated;
grant execute on function pcm.sso_portal_timeline_os(p_cliente_id uuid, p_os_id uuid, p_antes_data timestamp with time zone, p_antes_id uuid) to authenticated;
grant execute on function pcm.sso_portal_versao_materiais(p_cliente_id uuid, p_os_id uuid, p_lista_id uuid, p_revisao integer) to authenticated;
grant execute on function pcm.sso_portal_visitas_os(p_cliente_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_prever_conteudo_os(p_cliente_id uuid, p_visita_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_prever_vinculo_os_rotina(p_cliente_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_previa_composicao_visita(p_cliente_id uuid, p_visita_id uuid) to authenticated;
grant execute on function pcm.sso_previa_fotos_destino(p_lote_id uuid, p_chave text) to authenticated;
grant execute on function pcm.sso_previa_revisao_fila(p_cliente_id uuid, p_outbox_id uuid) to authenticated;
grant execute on function pcm.sso_previa_selecao_composicao(p_cliente_id uuid, p_itens jsonb) to authenticated;
grant execute on function pcm.sso_priorizar_composicao(p_request_id uuid, p_id uuid, p_revisao integer, p_g smallint, p_u smallint, p_t smallint, p_d smallint, p_motivo text) to authenticated;
grant execute on function pcm.sso_promover_backlog_chamado(p_request_id uuid, p_cliente_id uuid, p_composicao_id uuid, p_expected_revision integer, p_chamado_id uuid, p_titulo text, p_descricao text) to authenticated;
grant execute on function pcm.sso_promover_e_registrar_continuacao_parcial(p_promocao_request_id uuid, p_registro_request_id uuid, p_ator_id uuid, p_cliente_id uuid, p_retorno_id uuid, p_retorno_revision integer, p_chamado_anterior_id uuid, p_chamado_anterior_revision bigint, p_chamado_id uuid, p_parcela_id uuid, p_ciclo_id uuid, p_titulo text, p_descricao text, p_motivo text) to authenticated;
grant execute on function pcm.sso_promover_retorno_ciclo(p_request_id uuid, p_ator_esperado uuid, p_cliente_id uuid, p_retorno_id uuid, p_retorno_revision integer, p_chamado_id uuid, p_parcela_id uuid, p_ciclo_id uuid, p_titulo text, p_descricao text) to authenticated;
grant execute on function pcm.sso_promover_retorno_parcial(p_request_id uuid, p_ator_esperado uuid, p_cliente_id uuid, p_retorno_id uuid, p_retorno_revision integer, p_chamado_id uuid, p_parcela_id uuid, p_ciclo_id uuid, p_titulo text, p_descricao text) to authenticated;
grant execute on function pcm.sso_publicar_anexo_os(p_request_id uuid, p_publicacao_id uuid, p_nota_id uuid, p_titulo text) to authenticated;
grant execute on function pcm.sso_reabrir_chamado(p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint, p_motivo text) to authenticated;
grant execute on function pcm.sso_reconciliar_parcela_humana(p_request_id uuid, p_parcela_id uuid, p_os_id uuid, p_evidencia_id uuid, p_expected_revision integer, p_suspensao_revision integer, p_interrupcao_revision integer, p_estado text, p_confirma boolean, p_motivo text) to authenticated;
grant execute on function pcm.sso_registrar_contexto_pendencia(p_request_id uuid, p_pendencia_id uuid, p_revision integer, p_norma text, p_condicao text, p_motivo text) to authenticated;
grant execute on function pcm.sso_registrar_continuacao_devolvida(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_retorno_id uuid, p_expected_revision bigint, p_motivo text) to authenticated;
grant execute on function pcm.sso_registrar_supressao_semana(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_serie_id uuid, p_regra_id uuid, p_semana date, p_feriado_id uuid, p_feriado_revisao integer) to authenticated;
grant execute on function pcm.sso_relatorio_despesas_cliente(p_cliente_id uuid, p_inicio date, p_fim date) to authenticated;
grant execute on function pcm.sso_relatorio_despesas_os(p_cliente_id uuid, p_os_id uuid, p_inicio date, p_fim date) to authenticated;
grant execute on function pcm.sso_remover_caracteristica_grupo(p_request_id uuid, p_grupo_id uuid, p_expected_revision integer, p_chave text, p_motivo text) to authenticated;
grant execute on function pcm.sso_reprogramar_visita_alertas_declarados(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_visita_id uuid, p_revision integer, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_motivo text, p_vencimento_declarado date, p_alertas jsonb) to authenticated;
grant execute on function pcm.sso_resolver_pendencia_foto_manual(p_request_id uuid, p_pendencia_id uuid, p_revision integer, p_contexto_revision integer, p_evidencia_id uuid, p_confirma boolean, p_atestacao text, p_motivo text) to authenticated;
grant execute on function pcm.sso_resolver_pendencia_humana_v2(p_request_id uuid, p_pendencia_id uuid, p_revision integer, p_evidencia_id uuid, p_contexto_revision integer, p_atesta_condicao boolean, p_atestacao text, p_motivo text) to authenticated;
grant execute on function pcm.sso_resumo_despesas_os_visita(p_cliente_id uuid, p_visita_id uuid, p_apos uuid) to authenticated;
grant execute on function pcm.sso_resumo_despesas_visita(p_cliente_id uuid, p_visita_id uuid) to authenticated;
grant execute on function pcm.sso_resumo_outbox_reconciliacao(p_cliente_id uuid) to authenticated;
grant execute on function pcm.sso_retificar_vinculo_os_rotina(p_request_id uuid, p_cliente_id uuid, p_os_id uuid, p_revisao integer, p_acao text, p_motivo text, p_previa jsonb) to authenticated;
grant execute on function pcm.sso_retirar_anexo_levantamento(p_request_id uuid, p_tipo text, p_anexo_id uuid, p_motivo text) to authenticated;
grant execute on function pcm.sso_retirar_publicacao_visita(p_publicacao_id uuid, p_motivo text) to authenticated;
grant execute on function pcm.sso_revalidar_incerteza_os_local(p_cliente_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_revalidar_previa_fila(p_cliente_id uuid, p_outbox_id uuid, p_estado text, p_tentativas integer) to authenticated;
grant execute on function pcm.sso_revalidar_vinculo_os_conteudo(p_request_id uuid, p_cliente_id uuid, p_visita_id uuid, p_os_id uuid, p_revisao_visita integer, p_revisao_vinculo integer, p_previa jsonb) to authenticated;
grant execute on function pcm.sso_revisao_condicao_resolvida(p_pendencia_id uuid) to authenticated;
grant execute on function pcm.sso_revisar_condicao_parcela(p_request_id uuid, p_parcela_id uuid, p_os_id uuid, p_evidencia_id uuid, p_expected_revision integer, p_condicao text, p_atendida boolean, p_motivo text) to authenticated;
grant execute on function pcm.sso_revisar_continuacao_chamado(p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint, p_proposta_id uuid, p_descricao text, p_minutos integer) to authenticated;
grant execute on function pcm.sso_revogar_anexo_os(p_request_id uuid, p_revogacao_id uuid, p_publicacao_id uuid, p_motivo text) to authenticated;
grant execute on function pcm.sso_revogar_supressao_semana(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_supressao_id uuid, p_motivo text) to authenticated;
grant execute on function pcm.sso_status_vinculo_os_rotina(p_cliente_id uuid, p_os_id uuid) to authenticated;
grant execute on function pcm.sso_sync_funcionarios_visita(p_cliente_id uuid, p_visita_id uuid, p_apos uuid, p_limite integer) to authenticated;
grant execute on function pcm.sso_tecnicos_despesa_visita(p_cliente_id uuid, p_visita_id uuid, p_apos uuid) to authenticated;
grant execute on function pcm.sso_vincular_anexo_localizacao_atualizada(p_request_id uuid, p_tipo_anexo text, p_anexo_id uuid, p_decisao_revision integer) to authenticated;
grant execute on function pcm.sso_vincular_backlog_chamado(p_request_id uuid, p_composicao_id uuid, p_composicao_revision integer, p_chamado_id uuid, p_chamado_revision bigint) to authenticated;
grant execute on function pcm.sso_vincular_documento_levantamento(p_request_id uuid, p_lote_id uuid, p_chave text, p_nome text, p_titulo text) to authenticated;
grant execute on function pcm.sso_vincular_documento_staging_ativo(p_request_id uuid, p_documento_id uuid, p_tipo text, p_entidade_id uuid, p_decisao_revision integer) to authenticated;
grant execute on function pcm.sso_vincular_evidencia_material(p_request_id uuid, p_lista_id uuid, p_evento_revision integer, p_objeto_id uuid) to authenticated;
grant execute on function pcm.sso_vincular_os_rotina(p_request_id uuid, p_cliente_id uuid, p_os_id uuid, p_previa jsonb) to authenticated;
grant execute on function pcm.sso_vincular_pendencia_parcela(p_request_id uuid, p_composicao_id uuid, p_composicao_revision integer, p_chamado_revision bigint, p_escopo_revision bigint, p_pendencia_id uuid, p_parcela_id uuid) to authenticated;
