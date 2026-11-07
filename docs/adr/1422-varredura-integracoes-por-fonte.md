---
name: "docs-adr-1422-varredura-integracoes-por-fonte-md"
description: "Documento Sinérgica SO: ADR-1422 — Entrada de serviço para varredura por fonte"
alwaysApply: false
---

# ADR-1422 — Entrada de serviço para varredura por fonte

E01-S185: a entrada existente de varredura aceita uma fonte explícita de OS ou de origens internas, além da fila atual. Cada fonte usa a RPC transacional de progresso já existente, com sua própria autorização de serviço, controles de banco e variável de habilitação desligada por padrão. O pedido mantém identidade, revisão e limite da página; uma resposta perdida deve ser repetida com os mesmos parâmetros. A ausência de fonte preserva o contrato da fila.

O endpoint não agenda execução, não consulta Auvo e não comprova efeito externo. A paginação não fornece fotografia consistente das fontes. Antes de habilitar, validar segurança, idempotência, concorrência, limites, cobertura das fontes, permissões e revisão adversarial; nenhum gate é aberto por esta alteração.
