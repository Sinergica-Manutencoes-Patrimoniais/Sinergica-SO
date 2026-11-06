---
name: "docs-adr-0586-previa-cobertura-visita-md"
description: "Documento Sinérgica SO: ADR-0586 — Prévia de cobertura para Visita"
alwaysApply: false
---

# ADR-0586 — Prévia de cobertura para Visita

A prévia por pergunta passa a aceitar identidade de Visita comprovada pelo resolvedor privado, verificando versão e Rotina contra o retorno. A consulta do contrato congelado e o diagnóstico de obrigatoriedade usam essa prévia; ausência de contrato continua indeterminada. O caminho calendário é preservado e a migration falha se a definição original divergir.

Trata-se somente de leitura: não permite criar retorno, aprovar nem executar OS; a barreira 0729 permanece. O resolvedor não estabelece locks ou prova autenticidade de conteúdo. Nenhum gate foi ativado; testes e revisão permanecem necessários.
