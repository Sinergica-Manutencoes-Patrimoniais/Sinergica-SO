---
name: "docs-adr-0664-reaprovacao-apos-incorporacao-parcial-md"
description: "Documento Sinérgica SO: ADR-0664 — Reaprovação após correção parcial"
alwaysApply: false
---

# ADR-0664 — Reaprovação após correção parcial

Status: proposta; gates fechados, não homologada.

Após correção de linha não efetivada, 0887 inicia novo ciclo e invalida aprovações pendentes, mas mantém linhas já incorporadas/atualizadas e seu histórico imutável. A guarda de aprovação de campos de localização não exige nova conferência de linhas já efetivadas ou rejeitadas: exige apenas das linhas ainda sujeitas à futura aplicação. A correção de linhas efetivadas continua bloqueada; não há reversão automática.

O resumo considera também localizações atualizadas como efetivadas, sem exigi-las de novo no ciclo. A mudança não prova que outros caminhos de reabertura aceitam o lote, nem altera os bloqueios de dependência. Testar ciclo, concorrência, rejeição, efeitos oficiais e rollback antes de aplicar ou habilitar.
