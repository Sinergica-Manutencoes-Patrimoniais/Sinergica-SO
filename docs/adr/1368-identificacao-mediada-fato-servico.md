---
name: "docs-adr-1368-identificacao-mediada-fato-servico-md"
description: "Documento Sinérgica SO: ADR-1368 — Seleção e identificação mediadas de fato de serviço"
alwaysApply: false
---

# ADR-1368 — Seleção e identificação mediadas de fato de serviço

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Adicionar entradas mediadas para listar opções autorizadas e identificar o fato declarado. Listagem usa o gate de leitura; a escrita usa gate próprio inicialmente fechado. Ambas exigem sessão, capacidades de validação e Financeiro e trava de autorização; os núcleos permanecem privados e conservam suas verificações, idempotência, histórico e gates. A identificação continua sendo declaração humana, sem produzir faturável ou comprovar execução.

## Limites

Antes de ativar, validar integridade de Cliente e referências, ACL/RLS/FORCE, concorrência, gates, revogação, repetição e resposta perdida, além de revisão adversarial. Não habilitar escrita por abrir apenas a leitura; não gera cobrança ou recebível.
