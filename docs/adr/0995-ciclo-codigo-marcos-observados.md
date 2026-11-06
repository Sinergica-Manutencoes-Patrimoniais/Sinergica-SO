---
name: "docs-adr-0995-ciclo-codigo-marcos-observados-md"
description: "Documento Sinérgica SO: ADR-0995 — Inicialização do ciclo em marco observado"
alwaysApply: false
---

# ADR-0995 — Inicialização do ciclo em marco observado

Status: preparação privada, não homologada.

Quando o gate de marcos estiver habilitado, eventos já conectados de aprovação de levantamento, vínculo de OS ou sincronização devem inicializar o ciclo ausente a partir do Cliente do Sistema ou Componente existente, sob a mesma trava global de códigos. Em seguida registram somente o primeiro instante do marco; repetição não altera histórico. Um ciclo preexistente com Cliente divergente causa falha, sem transferir ou reescrever identidade.

A inicialização não inventa marcos históricos: só registra evento observado após ativação. Não cobre impressão de etiqueta, outras fontes de aprovação ou escritores não integrados. Gate permanece fechado; conferir backfill, dados legados, exclusões, ordem de locks, FORCE RLS, transações concorrentes, rollback e todos os fluxos antes de ativar. Eventos observados não autorizam edição de rascunho de registros anteriores sem inventário.
