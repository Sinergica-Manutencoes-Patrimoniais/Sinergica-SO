---
name: "docs-adr-0342-visibilidade-publicacao-materiais-md"
description: "Documento Sinérgica SO: ADR-0342 — Retirada e republicação da lista pública"
alwaysApply: false
---

# ADR-0342 — Retirada e republicação da lista pública

Status: proposta; gate fechado, sem testes.

A publicação sanitizada existente permanece imutável; PCM pode retirar e republicar exatamente a mesma versão revisada por eventos auditados. Republicar não altera linhas nem gera nova versão de conteúdo; para alterar conteúdo é necessária nova revisão/publicação. Enquanto o gate estiver ativo, a última publicação aplicável é exibida apenas se não retirada e disponibilidade do Cliente também fica bloqueada para versão retirada. Não se recorre silenciosamente a publicação antiga. Histórico preserva ator, data e motivo, sem enviar custo ou texto privado ao Portal. Como descrições são texto livre, revisão humana e prevenção de conteúdo sensível continuam obrigatórias. Testes e revisão de isolamento/concorrência antes da ativação.
