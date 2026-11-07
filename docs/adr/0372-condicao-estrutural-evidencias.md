---
name: "docs-adr-0372-condicao-estrutural-evidencias-md"
description: "Documento Sinérgica SO: ADR-0372 — Condição estrutural com requisitos de evidência"
alwaysApply: false
---

# ADR-0372 — Condição estrutural com requisitos de evidência

Status: proposta, não homologada.

Comando preparado revalida atomicamente a condição estrutural de respostas (0580) e os requisitos de evidência congelados por pergunta (0591). Bloqueia requisito indeterminado ou exigência aplicável sem decisão PCM aceita atual. Registra condição auditada, revisões de evidências/decisões e contagem de eventos de decisão por resposta. A transação não converte aceite humano em autenticidade de arquivo, não promove `cobertura_comprovada`, não aprova ou encerra OS.

Decisões posteriores, alterações de fontes ou revogação tornam a fotografia imprópria sem nova revalidação. Regra de tipos de evidência e fonte confiável permanecem pendentes. Gate próprio e EXECUTE fechados; testes e revisão adversarial são obrigatórios.
