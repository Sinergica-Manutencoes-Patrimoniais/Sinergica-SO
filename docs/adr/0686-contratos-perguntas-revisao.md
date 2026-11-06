---
name: "docs-adr-0686-contratos-perguntas-revisao-md"
description: "Documento Sinérgica SO: ADR-0686 — Reconferência de contratos na revisão do Plano"
alwaysApply: false
---

# ADR-0686 — Reconferência de contratos na revisão do Plano

Sob gate desligado, os comandos e consultas existentes de obrigatoriedade e evidência também aceitam Plano em revisão somente quando existe versão anteriormente aprovada e a Rotina pertence à versão rascunho. Permanecem revisão otimista do Plano, permissão `plano.gerir`, histórico, conferência do conteúdo da pergunta e gates originais. Rascunhos iniciais continuam com o comportamento anterior; versões aprovadas não são alteradas.

A mudança não aprova Plano nem garante equivalência do questionário. Gates, concessões e homologação permanecem fechados; concorrência, testes e revisão de segurança são necessários antes de ativar.
