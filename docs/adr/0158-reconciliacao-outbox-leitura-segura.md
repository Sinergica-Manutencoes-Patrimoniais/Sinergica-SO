---
name: "docs-adr-0158-reconciliacao-outbox-leitura-segura-md"
description: "Documento Sinérgica SO: ADR-0158 — Reconciliação preparada da outbox Auvo"
alwaysApply: false
---

# ADR-0158 — Reconciliação preparada da outbox Auvo

Status: proposta, não homologada.

O painel consulta metadados minimizados da outbox já existente, apenas para Sistemas e Componentes cujo Cliente ainda pode ser comprovado; não lê ou devolve erros brutos, payload, token ou custos. Sem lease/fencing do fluxo antigo, processamento e falha são classificados como incertos, e `sent` não comprova vínculo remoto. Anotações internas são append-only e exigem permissão atual, requestId, estado e contagem esperados. Não alteram fila, não disparam retry e não resolvem alertas.

As funções permanecem revogadas e gate fechado. Pendentes: demais entidades, tickets/OS, Comercial e Financeiro, consulta de evidência remota, prevenção de POST duplicado e recuperação pelo proprietário, varredura periódica, retenção/privacidade das anotações e testes, incluindo limpeza da outbox e revogação. Sem isso, não declarar E01-S185 concluída ou ativar.
