# Inventário de liberação S165/S166

Levantamento estático em 2026-11-05, com código até migration 1775. As flags Vite são avaliadas no build; quando ausentes ou diferentes da string `true`, os controles identificados por comparação estrita ficam desabilitados ou ocultos. Valores no `.env.example` são exemplos, não configuram um ambiente existente. Os gates de banco citados iniciam fechados nas respectivas migrations; seu estado real em qualquer ambiente deve ser verificado separadamente. Nenhuma flag ou gate foi ativado neste levantamento.

A tabela seguinte identifica **gates diretamente comprovados**, não uma lista suficiente para ativação. Operações encadeadas podem exigir outros gates, GRANTs, permissões por Cliente, dados válidos e revisões; habilitar uma flag isolada não libera segurança nem comprova homologação. Antes de qualquer rollout, concluir revisão, CI/db-tests, validação dos dados e permissões, ensaio de locks com volume representativo, e decisão operacional dos responsáveis. Não ativar operações Auvo sem autorização própria.

| Jornada | Flag(s) de interface | Gates comprovados no banco e evidência | Pré-condição adicional |
| --- | --- | --- | --- |
| Suspender/encerrar/retomar Plano | `VITE_SSO_TRANSICAO_PLANO_ENABLED` | `pcm.plano_transicao_gate`, [0416](../../../supabase/migrations/0416_E01-S165_transicoes_plano.sql) e [0419](../../../supabase/migrations/0419_E01-S165_retomar_plano_preparado.sql) | Ator autorizado ao Cliente, estado e revisão válidos; OS preservadas. |
| Aprovar revisão | `VITE_SSO_APROVAR_REVISAO_ENABLED` e `VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED` | `pcm.sso_aprovacao_revisao_mediada_gate`, `pcm.sso_concorrencia_impacto_gate`, `pcm.sso_protocolo_revisao_1731_gate`: [1651](../../../supabase/migrations/1651_E01-S165_aprovacao_revisao_mediada.sql), [1731](../../../supabase/migrations/1731_E01-S165_protocolo_revisao_transacional.sql) | Vigência, impactos, autorizações e validadores exigidos pelo servidor. |
| Preparar ciclo Calendário | `VITE_SSO_MATERIALIZAR_CICLO_CANONICO_ENABLED` | `pcm.sso_materializar_ciclo_canonico_gate`, `pcm.sso_identidade_ciclo_gate`, `pcm.ocorrencia_rotina_gate`, `pcm.sso_guarda_ciclo_canonico_gate`: [0734](../../../supabase/migrations/0734_E01-S166_materializar_ciclo_canonico.sql) | Versão e ciclo válidos; durante revisão a versão anterior ainda exige `pcm.sso_geracao_versao_anterior_gate` ([0755](../../../supabase/migrations/0755_E01-S165_geracao_durante_revisao.sql)). |
| Lote Calendário | `VITE_SSO_LOTE_CICLOS_CALENDARIO_ENABLED` | `pcm.sso_lote_ciclos_calendario_gate`: [0790](../../../supabase/migrations/0790_E01-S166_lote_ciclos_calendario.sql), além dos gates do ciclo | Janela civil limitada; autorização e origem conferidas. |
| Preparação e lote Visita | `VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED`, `VITE_SSO_LOTE_VISITA_CANONICA_ENABLED` | Lote: `pcm.sso_lote_visita_canonica_gate` ([0900](../../../supabase/migrations/0900_E01-S166_lote_ocorrencia_visita.sql)); preparação também depende dos gates de sua RPC | Visita e origem contratual válidas; permissões por Cliente. |
| Fila Calendário | `VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED` | `pcm.sso_fila_preventiva_pcm_gate` ([1494](../../../supabase/migrations/1494_E01-S166_fila_preventiva_pcm.sql)) | Ciclo elegível, autorização `plano.gerir`; confirmação/grupos têm requisitos próprios. |
| Fila Visita | `VITE_SSO_FILA_VISITA_ENABLED` | `pcm.sso_fila_visita_gate` ([1647](../../../supabase/migrations/1647_E01-S166_fila_preventiva_visita.sql)) | Autorização `plano.gerir` e `visita.confirmar`; Visita elegível. |

## Dependências encadeadas por cenário

O quadro acima registra o gate imediato de cada operação. As dependências abaixo detalham caminhos observados nas funções e nas fixtures; não constituem uma configuração mínima universal, nem uma instrução de ativação. O estado efetivo dos gates, permissões, dados e evidências deve ser verificado no ambiente correspondente.

| Cenário | Dependências observadas | Evidência e limite |
| --- | --- | --- |
| Revisão e aprovação mediada | Além dos gates da linha de aprovação, o núcleo usa `pcm.aprovacao_revisao_gate`. O protocolo exige `pcm.sso_continuidade_revisao_gate`, `pcm.sso_decisao_comparada_gate`, `pcm.sso_data_civil_geracao_gate` e `pcm.sso_snapshot_fuso_plano_gate`, bem como os triggers obrigatórios. O gate dedicado 1731 inicia fechado. | [1700](../../../supabase/migrations/1700_E01-S165_validadores_aprovacao_obrigatorios.sql), [1724](../../../supabase/migrations/1724_E01-S165_aplicar_selo_reserva_vigente.sql) e [1731](../../../supabase/migrations/1731_E01-S165_protocolo_revisao_transacional.sql). A interface exige as duas flags de aprovação da tabela anterior; não substitui os validadores. |
| Decisão e análise de impactos | As fixtures dos dois modos usam `pcm.sso_decisao_impacto_revisao_gate`, `pcm.sso_decisao_impacto_mediada_gate` e `pcm.sso_avaliacao_impacto_revisao_gate`; a decisão comparada também usa seu gate do protocolo. | [Calendário 1704](../../../supabase/tests/manual_E01-S165_impacto_calendario_nativo_1704.sql) e [Visita 1705](../../../supabase/tests/manual_E01-S165_impacto_visita_fila_1705.sql). Para as telas de diagnóstico e decisão, observar `VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED`, `VITE_SSO_AVALIACAO_IMPACTO_REVISAO_ENABLED` e `VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED`; resolução ou escolha de data tem flags próprias conforme o caso. |
| Origem e PMOC presentes no cenário | As mesmas fixtures usam `pcm.sso_origem_lote_gate`, `pcm.sso_origem_rotina_gate`, `pcm.sso_pmoc_mediado_gate`, `pcm.sso_diagnostico_pmoc_gate`, `pcm.sso_decisao_pmoc_gate`, `pcm.sso_vinculo_ciclo_pmoc_gate` e `pcm.sso_concorrencia_impacto_gate`. | Evidenciam a composição dessas jornadas sintéticas; não estabelecem que toda operação ou todo Plano precise da mesma composição. Classificações e fontes aplicáveis continuam sujeitas a conferência. |
| Preparação de Visita | A fixture exercita `pcm.sso_materializar_visita_canonica_gate`, `pcm.sso_identidade_ciclo_visita_gate` e `pcm.ocorrencia_rotina_gate`; a fila é uma etapa separada. | [Fixture 1705](../../../supabase/tests/manual_E01-S165_impacto_visita_fila_1705.sql). A flag de preparação individual difere da flag de lote; ambas dependem também da superfície que apresenta o comando. |
| Lote conferido de Calendário | A superfície `PrepararRotinasJanela` é condicionada conjuntamente a `VITE_SSO_LOTE_CICLOS_CALENDARIO_ENABLED`, `VITE_SSO_LOTE_CALENDARIO_CONFERIDO_ENABLED` e `VITE_SSO_ORIGEM_LOTE_ENABLED`. | [DetalhePlano.tsx](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L296); as operações chamadas conservam seus próprios gates e autorizações. |
| Alteração de escopo em revisão | A abertura do fluxo com contratos, a edição e a inclusão/retirada têm controles distintos: `VITE_SSO_REVISAO_COM_CONTRATOS_ENABLED`, `VITE_SSO_EDICAO_ROTINA_REVISAO_ENABLED` e `VITE_SSO_INCLUIR_RETIRAR_REVISAO_ENABLED`. | [DetalhePlano.tsx](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L119); aplicabilidade depende também do estado e da versão. |

As jornadas [Calendário 1731](../../../supabase/tests/manual_E01-S165_jornada_real_calendario_1731.sql) e [Visita 1731](../../../supabase/tests/manual_E01-S165_jornada_real_visita_1731.sql) usam dados sintéticos e ajustes de gates em transações revertidas. Não comprovam ausência global de efeitos externos, fonte contratual ou feriados externos; tampouco substituem validação operacional e homologação.

## Referências estáticas adicionais na interface

A relação abaixo é um inventário de flags encontradas nos componentes de `interfaces/plano-manutencao`; inclui funcionalidades auxiliares e caminhos alternativos. O arquivo indicado é a primeira ocorrência, não demonstra por si só todos os componentes ancestrais nem gates do banco. O mapeamento completo e a decisão de quais recursos comporão a entrega permanecem pendentes; **não habilitar todas em lote**.

| Flag | Primeira ocorrência |
| --- | --- |
| `VITE_SSO_ALTERACAO_CICLO_ENABLED` | [DecisaoImpactoOcorrencia.tsx:37](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DecisaoImpactoOcorrencia.tsx#L37) |
| `VITE_SSO_ALVOS_CRONOGRAMA_ENABLED` | [ExportarCronogramaFotografia.tsx:126](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExportarCronogramaFotografia.tsx#L126) |
| `VITE_SSO_APROVAR_REVISAO_ENABLED` | [AcoesRevisaoPlano.tsx:136](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/AcoesRevisaoPlano.tsx#L136) |
| `VITE_SSO_ATESTADO_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:62](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L62) |
| `VITE_SSO_AVALIACAO_IMPACTO_REVISAO_ENABLED` | [PreflightAprovacaoRevisao.tsx:30](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreflightAprovacaoRevisao.tsx#L30) |
| `VITE_SSO_AVALIACAO_IMPACTO_VISITA_ENABLED` | [AvaliacaoImpactoRevisao.tsx:19](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/AvaliacaoImpactoRevisao.tsx#L19) |
| `VITE_SSO_CAPACIDADE_CRONOGRAMA_ENABLED` | [ExportarCronogramaFotografia.tsx:131](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExportarCronogramaFotografia.tsx#L131) |
| `VITE_SSO_CHAMADO_PREVENTIVO_ENABLED` | [ObrigacoesPreparadas.tsx:60](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L60) |
| `VITE_SSO_CICLOS_UNIFORMES_ENABLED` | [DetalhePlano.tsx:439](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L439) |
| `VITE_SSO_CICLOS_UNIFORMES_MEDIADOS_ENABLED` | [CiclosUniformes.tsx:18](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/CiclosUniformes.tsx#L18) |
| `VITE_SSO_COMPARACAO_QUESTIONARIO_ENABLED` | [PreviaRevisionada.tsx:161](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaRevisionada.tsx#L161) |
| `VITE_SSO_COMPARAR_CALENDARIO_LEGADO_ENABLED` | [ConferenciaPlanoLegado.tsx:14](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ConferenciaPlanoLegado.tsx#L14) |
| `VITE_SSO_COMPARAR_QUANTIDADE_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:67](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L67) |
| `VITE_SSO_CONFERENCIA_COPIA_ROTINA_ENABLED` | [DetalhePlano.tsx:361](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L361) |
| `VITE_SSO_CONFERENCIA_FUSO_SERIES_ENABLED` | [PreflightAprovacaoRevisao.tsx:21](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreflightAprovacaoRevisao.tsx#L21) |
| `VITE_SSO_CONFERENCIA_PLANO_LEGADO_ENABLED` | [RelacaoPlanoLegado.tsx:345](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/RelacaoPlanoLegado.tsx#L345) |
| `VITE_SSO_CONFIRMAR_FILA_PREVENTIVA_ENABLED` | [FilaPreventivaPcm.tsx:45](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/FilaPreventivaPcm.tsx#L45) |
| `VITE_SSO_CONSULTAR_USO_CICLO_VERSAO_ENABLED` | [PreviaVencimentosPlano.tsx:99](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaVencimentosPlano.tsx#L99) |
| `VITE_SSO_CONTRATOS_EM_REVISAO_ENABLED` | [DetalhePlano.tsx:403](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L403) |
| `VITE_SSO_CONTRATO_EVIDENCIA_ENABLED` | [DetalhePlano.tsx:405](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L405) |
| `VITE_SSO_CONTRATO_PERGUNTAS_ENABLED` | [DetalhePlano.tsx:404](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L404) |
| `VITE_SSO_CONTRATO_PERGUNTA_MEDIADO_ENABLED` | [ContratoEvidencia.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ContratoEvidencia.tsx#L10) |
| `VITE_SSO_COPIA_PLANO_ENABLED` | [DetalhePlano.tsx:297](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L297) |
| `VITE_SSO_COPIA_ROTINA_MODELO_ENABLED` | [DetalhePlano.tsx:369](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L369) |
| `VITE_SSO_CRIAR_OS_GRUPO_ENABLED` | [IntencaoOsGrupo.tsx:38](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/IntencaoOsGrupo.tsx#L38) |
| `VITE_SSO_CRONOGRAMA_FERIADOS_DECLARADOS_ENABLED` | [ExportarCronogramaFotografia.tsx:35](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExportarCronogramaFotografia.tsx#L35) |
| `VITE_SSO_CRONOGRAMA_PARCIAL_ENABLED` | [DetalhePlano.tsx:305](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L305) |
| `VITE_SSO_DECISAO_FERIADO_CALENDARIO_ENABLED` | [PreviaCiclos.tsx:202](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaCiclos.tsx#L202) |
| `VITE_SSO_DECISAO_FOTO_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:65](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L65) |
| `VITE_SSO_DECISAO_IMPACTO_OCORRENCIA_ENABLED` | [PreviaRevisionada.tsx:109](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaRevisionada.tsx#L109) |
| `VITE_SSO_DECISAO_IMPACTO_VISITA_ENABLED` | [PreviaRevisionada.tsx:110](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaRevisionada.tsx#L110) |
| `VITE_SSO_DECISAO_PMOC_ENABLED` | [PropostaPmoc.tsx:30](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PropostaPmoc.tsx#L30) |
| `VITE_SSO_DECISAO_VENCIMENTO_ENABLED` | [PreviaCiclos.tsx:204](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaCiclos.tsx#L204) |
| `VITE_SSO_DECISAO_VENCIMENTO_MEDIADA_ENABLED` | [DecidirVencimento.tsx:26](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DecidirVencimento.tsx#L26) |
| `VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED` | [AvaliacaoImpactoRevisao.tsx:28](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/AvaliacaoImpactoRevisao.tsx#L28) |
| `VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED` | [AvaliacaoImpactoRevisao.tsx:9](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/AvaliacaoImpactoRevisao.tsx#L9) |
| `VITE_SSO_DIAGNOSTICO_FUSO_VIGENCIA_ENABLED` | [AcoesRevisaoPlano.tsx:344](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/AcoesRevisaoPlano.tsx#L344) |
| `VITE_SSO_DIAGNOSTICO_MODO_VISITA_ENABLED` | [DetalhePlano.tsx:444](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L444) |
| `VITE_SSO_DIAGNOSTICO_NORMATIVO_ENABLED` | [DetalhePlano.tsx:443](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L443) |
| `VITE_SSO_DIAGNOSTICO_PMOC_ENABLED` | [PreviaCiclos.tsx:187](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaCiclos.tsx#L187) |
| `VITE_SSO_DIAGNOSTICO_VIGENCIAS_ENABLED` | [PreviaRevisionada.tsx:108](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaRevisionada.tsx#L108) |
| `VITE_SSO_EDICAO_ROTINA_REVISAO_ENABLED` | [DetalhePlano.tsx:446](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L446) |
| `VITE_SSO_ESCOPO_PREVENTIVO_ENABLED` | [CiclosUniformes.tsx:46](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/CiclosUniformes.tsx#L46) |
| `VITE_SSO_ESFORCO_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:68](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L68) |
| `VITE_SSO_ESFORCO_GRUPO_MEDIADO_ENABLED` | [EsforcoGrupo.tsx:9](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/EsforcoGrupo.tsx#L9) |
| `VITE_SSO_ESTADO_OCORRENCIA_VINCULADA_ENABLED` | [ObrigacoesPreparadas.tsx:59](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L59) |
| `VITE_SSO_EXIGENCIA_LEGAL_ENABLED` | [DetalhePlano.tsx:440](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L440) |
| `VITE_SSO_EXIGENCIA_ROTINA_MEDIADA_ENABLED` | [ExigenciaLegalRotina.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExigenciaLegalRotina.tsx#L10) |
| `VITE_SSO_EXPORTAR_PLANO_CSV_ENABLED` | [ExportarVersaoPlano.tsx:79](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExportarVersaoPlano.tsx#L79) |
| `VITE_SSO_EXPORTAR_PLANO_ENABLED` | [DetalhePlano.tsx:301](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L301) |
| `VITE_SSO_EXPORTAR_PLANO_XLSX_ENABLED` | [ExportarVersaoPlano.tsx:80](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExportarVersaoPlano.tsx#L80) |
| `VITE_SSO_EXPORTAR_PREVIA_CICLOS_CSV_ENABLED` | [ExportarPreviaCiclos.tsx:31](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExportarPreviaCiclos.tsx#L31) |
| `VITE_SSO_EXPORTAR_PREVIA_CICLOS_ENABLED` | [PreviaCiclos.tsx:182](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaCiclos.tsx#L182) |
| `VITE_SSO_FILA_OBRIGACOES_PREPARADAS_ENABLED` | [DetalhePlano.tsx:115](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L115) |
| `VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED` | [FilaAposPreparacao.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/FilaAposPreparacao.tsx#L10) |
| `VITE_SSO_FILA_SELECIONADA_ENABLED` | [ObrigacoesPreparadas.tsx:56](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L56) |
| `VITE_SSO_FILA_VISITA_ENABLED` | [FilaAposPreparacao.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/FilaAposPreparacao.tsx#L10) |
| `VITE_SSO_FOTO_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:63](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L63) |
| `VITE_SSO_FUSO_PLANO_DECLARADO_ENABLED` | [DetalhePlano.tsx:117](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L117) |
| `VITE_SSO_FUSO_PLANO_MEDIADO_ENABLED` | [FusoPlanoDeclarado.tsx:12](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/FusoPlanoDeclarado.tsx#L12) |
| `VITE_SSO_GERACAO_FUSO_SNAPSHOT_ENABLED` | [MaterializarCicloCanonico.tsx:374](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/MaterializarCicloCanonico.tsx#L374) |
| `VITE_SSO_GERACAO_OU_SUPRESSAO_ENABLED` | [GerarVisitaContratual.tsx:45](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/GerarVisitaContratual.tsx#L45) |
| `VITE_SSO_GERACAO_VISITA_SUPRESSAO_ENABLED` | [GerarVisitaContratual.tsx:18](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/GerarVisitaContratual.tsx#L18) |
| `VITE_SSO_GERAR_VISITA_CONTRATUAL_ENABLED` | [VincularSerieRotina.tsx:39](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/VincularSerieRotina.tsx#L39) |
| `VITE_SSO_HISTORICO_CICLO_CANONICO_ENABLED` | [PreviaCiclos.tsx:201](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaCiclos.tsx#L201) |
| `VITE_SSO_HISTORICO_TRANSICOES_PLANO_ENABLED` | [TransicaoPlano.tsx:27](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/TransicaoPlano.tsx#L27) |
| `VITE_SSO_IMPACTO_PMOC_REVISAO_ENABLED` | [ImpactoPmocRevisao.tsx:12](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ImpactoPmocRevisao.tsx#L12) |
| `VITE_SSO_IMPACTO_REVISAO_OS_ENABLED` | [PreviaRevisionada.tsx:106](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaRevisionada.tsx#L106) |
| `VITE_SSO_INCLUIR_RETIRAR_REVISAO_ENABLED` | [DetalhePlano.tsx:143](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L143) |
| `VITE_SSO_INDICIOS_REVISAO_ROTINA_ENABLED` | [PreviaRevisionada.tsx:107](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaRevisionada.tsx#L107) |
| `VITE_SSO_INTEGRAR_LEGADA_EXISTENTE_ENABLED` | [MaterializarCicloLegado.tsx:25](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/MaterializarCicloLegado.tsx#L25) |
| `VITE_SSO_INTENCAO_OS_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:58](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L58) |
| `VITE_SSO_INVENTARIO_GERACAO_LEGADA_ENABLED` | [TransicaoPlano.tsx:42](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/TransicaoPlano.tsx#L42) |
| `VITE_SSO_INVENTARIO_PMOC_REVISAO_ENABLED` | [InventarioPmocRevisao.tsx:11](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/InventarioPmocRevisao.tsx#L11) |
| `VITE_SSO_LOCALIZAR_COPIA_ROTINA_ENABLED` | [DetalhePlano.tsx:445](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L445) |
| `VITE_SSO_LOTE_CALENDARIO_CONFERIDO_ENABLED` | [DetalhePlano.tsx:296](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L296) |
| `VITE_SSO_LOTE_CICLOS_CALENDARIO_ENABLED` | [DetalhePlano.tsx:296](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L296) |
| `VITE_SSO_LOTE_CICLOS_LEGADOS_ENABLED` | [MaterializarCicloLegado.tsx:25](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/MaterializarCicloLegado.tsx#L25) |
| `VITE_SSO_LOTE_VISITA_CANONICA_ENABLED` | [PreviaOcorrenciasVisita.tsx:62](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaOcorrenciasVisita.tsx#L62) |
| `VITE_SSO_LOTE_VISITA_LEGADO_ENABLED` | [MaterializarVisitaLegado.tsx:24](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/MaterializarVisitaLegado.tsx#L24) |
| `VITE_SSO_MATERIALIZAR_CICLO_CANONICO_ENABLED` | [CiclosUniformes.tsx:38](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/CiclosUniformes.tsx#L38) |
| `VITE_SSO_MATERIALIZAR_CICLO_LEGADO_ENABLED` | [IntegrarOrigemOcorrencia.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/IntegrarOrigemOcorrencia.tsx#L10) |
| `VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED` | [PreviaOcorrenciasVisita.tsx:23](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaOcorrenciasVisita.tsx#L23) |
| `VITE_SSO_MATERIALIZAR_VISITA_LEGADO_ENABLED` | [IntegrarOrigemOcorrencia.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/IntegrarOrigemOcorrencia.tsx#L10) |
| `VITE_SSO_METADADOS_EXPORTACAO_ENABLED` | [ExportarVersaoPlano.tsx:22](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExportarVersaoPlano.tsx#L22) |
| `VITE_SSO_NATUREZA_ALVO_ROTINA_ENABLED` | [CopiarRotinaModelo.tsx:214](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/CopiarRotinaModelo.tsx#L214) |
| `VITE_SSO_NOVA_DATA_CICLO_ENABLED` | [EscolherNovaDataCalendario.tsx:13](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/EscolherNovaDataCalendario.tsx#L13) |
| `VITE_SSO_NOVA_DATA_VISITA_ENABLED` | [EscolherNovaVisita.tsx:13](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/EscolherNovaVisita.tsx#L13) |
| `VITE_SSO_OBRIGACOES_PMOC_ENABLED` | [ObrigacoesPmoc.tsx:8](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPmoc.tsx#L8) |
| `VITE_SSO_OCORRENCIAS_REVISAO_ENABLED` | [IndiciosRevisaoRotina.tsx:8](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/IndiciosRevisaoRotina.tsx#L8) |
| `VITE_SSO_ORIGEM_EFETIVA_CICLO_ENABLED` | [MaterializarCicloCanonico.tsx:42](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/MaterializarCicloCanonico.tsx#L42) |
| `VITE_SSO_ORIGEM_LOTE_ENABLED` | [DetalhePlano.tsx:296](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L296) |
| `VITE_SSO_ORIGEM_ROTINA_ENABLED` | [OrigemGeracaoRotina.tsx:11](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/OrigemGeracaoRotina.tsx#L11) |
| `VITE_SSO_PMOC_MEDIADO_ENABLED` | [DiagnosticoPmoc.tsx:8](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DiagnosticoPmoc.tsx#L8) |
| `VITE_SSO_PRECONDICAO_IMPACTOS_ENABLED` | [PreflightAprovacaoRevisao.tsx:30](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreflightAprovacaoRevisao.tsx#L30) |
| `VITE_SSO_PRECONDICAO_IMPACTO_MEDIADA_ENABLED` | [PrecondicaoImpactos.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PrecondicaoImpactos.tsx#L10) |
| `VITE_SSO_PREFLIGHT_APROVACAO_REVISAO_ENABLED` | [AcoesRevisaoPlano.tsx:345](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/AcoesRevisaoPlano.tsx#L345) |
| `VITE_SSO_PREPARAR_CICLO_VENCIDO_ENABLED` | [PreviaVencimentosPlano.tsx:140](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaVencimentosPlano.tsx#L140) |
| `VITE_SSO_PREVIA_OCORRENCIA_VISITA_ENABLED` | [VincularSerieRotina.tsx:37](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/VincularSerieRotina.tsx#L37) |
| `VITE_SSO_PREVIA_VENCIMENTOS_OCORRENCIAS_ENABLED` | [PreviaVencimentosPlano.tsx:29](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaVencimentosPlano.tsx#L29) |
| `VITE_SSO_PREVIA_VENCIMENTOS_PLANO_ENABLED` | [DetalhePlano.tsx:295](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L295) |
| `VITE_SSO_PROPOSTA_ENCERRAMENTO_OCORRENCIA_ENABLED` | [DeclaracaoEscopoPreventivo.tsx:23](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DeclaracaoEscopoPreventivo.tsx#L23) |
| `VITE_SSO_PROPOSTA_PMOC_ENABLED` | [DiagnosticoPmoc.tsx:19](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DiagnosticoPmoc.tsx#L19) |
| `VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED` | [AcoesRevisaoPlano.tsx:136](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/AcoesRevisaoPlano.tsx#L136) |
| `VITE_SSO_PROVENIENCIA_ROTINA_MODELO_ENABLED` | [DetalhePlano.tsx:365](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L365) |
| `VITE_SSO_PROXIMO_CICLO_ANCORADO_ENABLED` | [PreviaCiclos.tsx:199](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaCiclos.tsx#L199) |
| `VITE_SSO_QUANTIDADE_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:66](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L66) |
| `VITE_SSO_RECIBO_COPIA_ROTINA_ENABLED` | [CopiarRotinaModelo.tsx:197](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/CopiarRotinaModelo.tsx#L197) |
| `VITE_SSO_RECIBO_EXIGENCIA_ROTINA_ENABLED` | [ExigenciaLegalRotina.tsx:42](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExigenciaLegalRotina.tsx#L42) |
| `VITE_SSO_RECONCILIAR_LEGADA_INERTE_ENABLED` | [MaterializarCicloLegado.tsx:25](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/MaterializarCicloLegado.tsx#L25) |
| `VITE_SSO_REGISTRAR_FOTO_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:64](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L64) |
| `VITE_SSO_REGISTRAR_OCORRENCIA_GRUPO_ENABLED` | [ConferirGrupoFila.tsx:35](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ConferirGrupoFila.tsx#L35) |
| `VITE_SSO_RELACAO_PLANO_LEGADO_ENABLED` | [IntegrarOrigemOcorrencia.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/IntegrarOrigemOcorrencia.tsx#L10) |
| `VITE_SSO_RESOLUCAO_IMPACTO_ENABLED` | [ResolverRetiradaImpacto.tsx:11](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ResolverRetiradaImpacto.tsx#L11) |
| `VITE_SSO_REVISAO_COM_CONTRATOS_ENABLED` | [DetalhePlano.tsx:119](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L119) |
| `VITE_SSO_REVISAO_COM_EVIDENCIAS_ENABLED` | [IniciarRevisaoContratos.tsx:10](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/IniciarRevisaoContratos.tsx#L10) |
| `VITE_SSO_REVISAO_COM_EXIGENCIAS_ENABLED` | [ExigenciaLegalRotina.tsx:42](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ExigenciaLegalRotina.tsx#L42) |
| `VITE_SSO_REVISAR_ROTINA_APROVADA_ENABLED` | [DetalhePlano.tsx:445](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L445) |
| `VITE_SSO_TRANSICAO_PLANO_ENABLED` | [Workspace.tsx:265](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/Workspace.tsx#L265) |
| `VITE_SSO_TRANSICAO_PLANO_MEDIADA_ENABLED` | [TransicaoPlano.tsx:28](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/TransicaoPlano.tsx#L28) |
| `VITE_SSO_TRIAGEM_CICLO_ATRASADO_ENABLED` | [PreviaCiclos.tsx:189](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/PreviaCiclos.tsx#L189) |
| `VITE_SSO_VIGENCIA_ROTINA_SERIE_ENABLED` | [VincularSerieRotina.tsx:36](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/VincularSerieRotina.tsx#L36) |
| `VITE_SSO_VINCULAR_ROTINA_SERIE_ENABLED` | [DetalhePlano.tsx:400](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/DetalhePlano.tsx#L400) |
| `VITE_SSO_VINCULO_CICLO_PMOC_ENABLED` | [VinculoCicloPmoc.tsx:20](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/VinculoCicloPmoc.tsx#L20) |
| `VITE_SSO_VINCULO_OS_GRUPO_ENABLED` | [ObrigacoesPreparadas.tsx:58](../../../apps/web/src/features/pcm/interfaces/plano-manutencao/ObrigacoesPreparadas.tsx#L58) |
