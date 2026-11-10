---
name: "docs-adr-1367-mediacao-diagnosticos-servico-md"
description: "Documento Sinérgica SO: ADR-1367 — Diagnóstico e prévia mediados de serviço"
alwaysApply: false
---

# ADR-1367 — Diagnóstico e prévia mediados de serviço

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Usar o gate de leitura de fato do ADR-1366 para duas entradas mediadas: diagnóstico de origens e prévia de serviço. Ambas exigem sessão, capacidades de execução e Financeiro, trava de autorização e confirmação de Cliente. Os núcleos existentes permanecem privados e seus próprios gates continuam obrigatórios. As respostas mantêm avisos de que a execução, a exclusividade e a emissão não foram comprovadas.

## Limites

Não cria faturável, lançamento ou cobrança e não comprova inexistência de outras origens. Antes de ativar: revisar permissões dos núcleos, isolamento, revogação, locks de todos os gates e fontes, concorrência e testes integrados com revisão adversarial.
