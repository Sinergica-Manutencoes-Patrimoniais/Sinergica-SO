---
name: "docs-adr-0381-encerramento-individual-os-md"
description: "Documento Sinérgica SO: ADR-0381 — Encerramento individual preparado de OS"
alwaysApply: false
---

# ADR-0381 — Encerramento individual preparado de OS

Status: proposta, não homologada.

O comando preparado exige atestação PCM de retorno atual, últimas decisões versionadas coerentes, condição de evidência e requisitos congelados revalidados, pendência já registrada para cada Não OK e revisão da OS por status e `updated_at`. Transiciona exclusivamente a OS vinculada usando `fn_operacao_alterar_status_lote(..., 'finalizado')`, estado do legado; não encerra Chamado nem modifica outra OS. A transação mantém auditoria e retry. A confirmação PCM não autentica conteúdo nem afirma procedência Auvo.

Alterar status dispara os eventos legados de OS e pode criar notificação no Portal (0143); não há chamada Auvo explícita neste comando. Esses efeitos, a diferença de nomenclatura `finalizado`/`concluida`, privilégios de execução da função canônica e conciliação/reabertura exigem revisão adversarial e testes. Gate próprio e EXECUTE fechados; não ativar ou aplicar sem homologação.
