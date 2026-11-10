---
name: "docs-adr-0880-s171-intencao-os-enviada-mediada-md"
description: "Documento Sinérgica SO: ADR-0880 — Mediação de intenção de OS enviada"
alwaysApply: false
---

# ADR-0880 — Mediação de intenção de OS enviada

Data: 2026-10-30 · Status: proposta, não implantada

## Contexto

As funções de 0435 registram e listam intenção interna de reprogramação de OS com tarefa Auvo identificada, mas permanecem privadas. A interface não tem caminho autorizado. Essa intenção não move a OS, altera a tarefa remota ou comprova reconciliação.

## Decisão

Preparar mediadoras autenticadas de criação e listagem com READ COMMITTED, trava compartilhada do protocolo de autorização e trava/releitura do gate existente. O núcleo privado mantém validações de Cliente, estado, revisões, vínculo, identidade da tarefa, idempotência e auditoria. O gate permanece fechado. O cliente troca os nomes das duas RPCs sem fallback ao núcleo.

Triagem, histórico e conciliação permanecem independentes e não são liberados por esta decisão. Antes de ativação, comprovar fontes de autorização e seus escritores, concorrência do gate, OS e vínculos, contrato e identidade externa, isolamento, HTTP, compatibilidade e revisão adversarial. Não usar intenção como evidência de mudança remota. Sem disparo Auvo ou deploy nesta etapa.
