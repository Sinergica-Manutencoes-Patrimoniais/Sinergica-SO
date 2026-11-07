---
name: "docs-adr-0347-copiar-contratos-revisao-plano-md"
description: "Documento Sinérgica SO: ADR-0347 — Cópia conservadora dos contratos em revisão"
alwaysApply: false
---

# ADR-0347 — Cópia conservadora dos contratos em revisão

Status: proposta, não homologada.

Um comando preparado inicia revisão pelo fluxo canônico e, na mesma transação, copia contratos congelados da versão anterior apenas quando identidade lógica da Rotina, questionário e conteúdo integral da pergunta ainda correspondem. Usa a configuração canônica de contrato para cada cópia e encadeia revisões do Plano. Perguntas alteradas, removidas ou sem contrato histórico não são inferidas; ficam pendentes de reconferência e podem impedir aprovação sob o gate 0567. Não altera questionário Auvo nem snapshots anteriores.

Gate próprio nasce fechado e não substitui automaticamente o fluxo legado. O comando não executa OS. Testes de concorrência, reprocessamento, snapshots legados e revisão adversarial são obrigatórios antes de ativar.
