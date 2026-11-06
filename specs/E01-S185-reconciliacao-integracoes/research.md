# Pesquisa — E01-S185

## Evidências locais

`supabase/migrations/0050_E00-S11_auvo_sync_health.sql` possui `auvo_sync_state`/view de saúde. `supabase/functions/pcm-auvo-push/index.ts` registra estados do drain. Reutilizar `apps/web/src/features/pcm/pages/PcmDashboardPage.tsx`, `infrastructure/supabase-dashboard-pcm-adapter.ts` e view `pcm.auvo_sync_error_details` da migration 0166 (E01-S123) (saúde Auvo drilldown), claims de outbox e logs estruturados existentes; ampliar para tentativas/objeto, sem outra fila que dispute com E01-S168. Comercial e faturável seguem contratos E01-S181/E01-S182, não criar terceiro orçamento ou novo ledger financeiro.

## Decisões

**Decisão:** evoluir caminhos existentes em vez de outro fluxo concorrente. **Motivo:** preservar IDs e rastreabilidade. **Alternativa rejeitada:** reconstrução independente e conversão destrutiva.

**Decisão:** Projeção paginada normaliza apenas metadados de integração por objeto e links de contexto. Cada fluxo continua dono dos comandos, idempotência e regra de precedência. Dispatcher valida permissão e encaminha reconciliação/retry ao proprietário com requestId/expectedRevision; não reexecuta POST genérico. Unicidade integração/tipoObjeto/objetoId/tipoDivergência/versão evita alertas duplicados. Worker de varredura observa pendências/leases em lote com cursor; não altera fatos financeiros ou decisões PCM diretamente. Painel TanStack Query invalida após ação e mostra estados de carregando/vazio/erro/sucesso, teclado/foco. Custos/payload completos nunca entram na projeção acessível a perfil sem permissão.

**Alternativa rejeitada:** retry cego, unicidade presumida do fornecedor e uso do horário de chegada como ordem confiável de execução.

## Provas técnicas futuras

Provas de contratos de E01-S168/175/181/182 e política de recuperação por erro são pré-requisitos à habilitação real. 4xx determinístico não tem retry automático infinito; 429/5xx/rede usam backoff limitado, respeitando Retry-After quando disponível, e tentativa ambígua exige conciliação. Evidência deve conter ambiente/versão/executor sem secrets.

Fontes funcionais: SSO-020; CT-005, CT-028, CT-029; integrações Auvo, Comercial e Financeiro. Respostas consolidadas do Fabrício prevalecem sobre trechos incompatíveis do Word; não são instruções de executar APIs. Não há pergunta de negócio nova bloqueadora. Não houve homologação real nesta pesquisa. Contrato compartilhado e ADR-0026/0027/0028 definem interfaces entre stories.
