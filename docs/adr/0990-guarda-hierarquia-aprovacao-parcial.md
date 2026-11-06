---
name: "docs-adr-0990-guarda-hierarquia-aprovacao-parcial-md"
description: "Documento Sinérgica SO: ADR-0990 — Guarda comum da hierarquia na aprovação parcial"
alwaysApply: false
---

# ADR-0990 — Guarda comum da hierarquia na aprovação parcial

Status: preparação privada, não homologada.

Preparar trigger antes da inserção de aprovação parcial para exigir a verificação acíclica do ADR-0989 em todos os caminhos de aprovação, inclusive o mediador legado. Quando o pai referenciado está no lote, validar compatibilidade dos tipos segundo os incorporadores existentes: Área não tem pai; Local aponta para Área; Sublocal aponta para Local ou Sublocal; Sistema pode apontar para Área ou Local; Equipamento/Grupo para Local; Componente para Local ou Equipamento. Referências fora do lote não são interpretadas ou aprovadas como existentes por essa guarda.

A guarda não substitui validação de entidade oficial, identidade de Cliente, duplicidade, autorização ou incorporação. Não altera aprovações históricas; inventariar inconsistências antes de aplicar. Gates de aprovação permanecem fechados até revisar tipos reais, regras de cadastro existente, custo de execução por linha, locks, RLS/FORCE, concorrência e revisão adversarial; executar testes antes do rollout. Não aplicar em produção nesta etapa.
