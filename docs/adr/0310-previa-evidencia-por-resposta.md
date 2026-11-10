---
name: "docs-adr-0310-previa-evidencia-por-resposta-md"
description: "Documento Sinérgica SO: ADR-0310 — Prévia de evidências declaradas por resposta"
alwaysApply: false
---

# ADR-0310 — Prévia de evidências declaradas por resposta

Status: proposta, não homologada.

Consulta apresenta respostas armazenadas no retorno e a contagem de associações explícitas a evidências declaradas para cada uma. Ausência de associação é bloqueio de cobertura declarada; presença não comprova autenticidade, integridade do anexo, execução ou atendimento do requisito de evidência da pergunta. A consulta não substitui conferência do snapshot completo nem inclui automaticamente perguntas sem resposta. Uma futura validação deve também conferir snapshot, vínculo e fonte de evidência autenticada.

Não atualiza cobertura, OS ou Chamado. Gates existentes e EXECUTE ficam fechados, com testes e revisão adversarial necessários antes de ativação.
