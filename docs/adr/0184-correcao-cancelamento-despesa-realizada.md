---
name: "docs-adr-0184-correcao-cancelamento-despesa-realizada-md"
description: "Documento Sinérgica SO: ADR-0184 — Correção e cancelamento de despesa realizada"
alwaysApply: false
---

# ADR-0184 — Correção e cancelamento de despesa realizada

**Estado:** preparação fechada, sem homologação nem implantação.

A despesa realizada pode ter data e descrição corrigidas com motivo e registro anterior/posterior, preservando valor e comprovante da realização. Cancelamento lógico conserva valor, comprovante e histórico e não exclui registros nem altera Financeiro. A transição exige revisão, autorização, comprovante de realização, declaração de conferência e motivo; é recusada se houver item faturável não cancelado ou alocação já existente, inclusive estornada. Esse bloqueio conservador evita confundir estorno lógico com estorno financeiro.

Alterar o valor realizado ou substituir comprovante exige fluxo próprio ainda não implementado; não sobrescrever evidência original. O modelo ainda não prova a inexistência de lançamentos legados desvinculados, então a declaração humana não é garantia automática de ausência de efeito financeiro. Não habilitar até reconciliar origens, cancelamentos, estornos e competências no Financeiro, impedir alterações legadas paralelas, conferir relatórios, autorização e concorrência e concluir testes/revisão adversarial. Gate e RPC permanecem fechados.
