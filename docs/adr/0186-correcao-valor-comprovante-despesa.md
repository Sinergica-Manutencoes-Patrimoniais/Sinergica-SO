---
name: "docs-adr-0186-correcao-valor-comprovante-despesa-md"
description: "Documento Sinérgica SO: ADR-0186 — Correção de valor e comprovante da despesa realizada"
alwaysApply: false
---

# ADR-0186 — Correção de valor e comprovante da despesa realizada

**Estado:** preparação bloqueada, não homologada nem implantada.

Correção registra valor anterior e novo e referência a comprovante anterior e novo em evento imutável. Quando não há novo comprovante, mantém-se o atual; quando há, o objeto deve ter sido enviado ao bucket privado para a mesma despesa pelo mesmo operador. A realização original e os objetos históricos nunca são apagados. Consulta corrente de comprovante aponta à última correção, sem permitir leitura direta do bucket. A alteração preserva previsão e não cria nem modifica lançamento, repasse ou cobrança.

Mesmo que um estorno lógico exista, qualquer alocação histórica continua bloqueando a correção até reconciliação financeira coordenada; qualquer faturável ativo também bloqueia. Vínculos legados não identificados não podem ser considerados automaticamente inexistentes: registrar conferência humana, com gate fechado. Soma do rateio vigente precisa permanecer compatível. Antes de ativar, revisar integridade e versionamento dos comprovantes, leitura histórica, correção/exclusão no Storage, concorrência e revogação, retenção de órfãos, relatórios, migração do legado e efeitos financeiros, além de testes e revisão adversarial.
