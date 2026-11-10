---
name: "docs-adr-0656-retrato-localizacoes-lote-md"
description: "Documento Sinérgica SO: ADR-0656 — Retrato selecionado na aplicação de localizações"
alwaysApply: false
---

# ADR-0656 — Retrato selecionado na aplicação de localizações

Status: proposta; gate fechado, não homologada.

O executor de localização compara, sob lock do lote, a revisão em que cada item foi selecionado, o retrato integral da linha e os campos que o PCM viu. Qualquer edição posterior exige refazer a seleção; o comando 0845 continua validando aprovação, conferência e snapshot oficial. Repetição do requestId segue tratada pelo executor original antes de comparar o estado atual.

Não modifica cadastros nesta etapa. Gates/RPCs permanecem fechados; testar concorrência, retry, isolamento de Cliente e supressão de sync antes de aplicar ou habilitar.
