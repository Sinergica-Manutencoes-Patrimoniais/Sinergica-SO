---
name: "docs-adr-0218-seletores-vinculo-backlog-md"
description: "Documento Sinérgica SO: ADR-0218 — Seletores de vínculo Backlog/Chamado"
alwaysApply: false
---

# ADR-0218 — Seletores de vínculo Backlog/Chamado

## Decisão

Preparar consultas paginadas e de contexto mínimo para selecionar Chamado do Cliente, e Pendência/parcela ainda não vinculadas da composição. Cada leitura exige capacidades atuais de execução e gestão de escopo; retorna identificadores, rótulos e revisões necessárias. As escritas 0438/0441 revalidam tudo transacionalmente. Funções revogadas e interface sob flag fechada.

## Limites

Seleção não comprova equivalência semântica; revisão humana é obrigatória. Permissões, concorrência, integridade com escritores legados e tratamento de tentativas incertas precisam de testes/revisão antes de ativar. Sem aplicação ou testes.
