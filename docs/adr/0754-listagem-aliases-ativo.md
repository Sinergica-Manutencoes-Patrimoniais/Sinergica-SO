---
name: "docs-adr-0754-listagem-aliases-ativo-md"
description: "Documento Sinérgica SO: ADR 0754 — Listagem de aliases no cadastro"
alwaysApply: false
---

# ADR 0754 — Listagem de aliases no cadastro

## Decisão

Disponibilizar consulta paginada de códigos anteriores de Sistema ou Componente, restrita ao Cliente do ativo e à capacidade atual `cadastro.ler`, sob gate desligado por padrão. A consulta devolve apenas código anterior, data e identificador do alias para paginação; não expõe motivo ou identidade administrativa sem necessidade operacional comprovada. Não altera códigos, aliases, históricos ou integração externa.

A interface é adicional e tem flag desligada; resultado ausente ou não carregado não prova inexistência global de códigos. Gates e ACL das funções já existentes permanecem inalterados. Antes de ativação são necessárias validações de isolamento, revogação, paginação, ambiguidade legada e revisão de segurança. Não renumerar nem migrar dados antigos.

A paginação por identificador não é snapshot: um alias concorrente pode surgir antes do cursor e não aparecer nas páginas restantes. A interface explicita essa limitação e permite reiniciar a consulta desde a primeira página; atualizar não torna o resultado um retrato transacional.
