---
name: "docs-adr-0388-guarda-encerramento-chamado-md"
description: "Documento Sinérgica SO: ADR-0388 — Guarda contra bypass do encerramento conferido"
alwaysApply: false
---

# ADR-0388 — Guarda contra bypass do encerramento conferido

Status: proposta, não homologada.

Quando o gate de encerramento conferido estiver ligado, toda transição do campo de encerramento do Chamado para valor não nulo exige token transacional privado, criado apenas pelo wrapper 0611 após suas verificações. Com gate desligado, comportamento legado permanece inalterado. Outras operações de escopo não exigem token. Token não é concedido a clientes e é removido após a chamada canônica; falha reverte a transação.

A guarda não resolve escritores legados que alterem outros campos ou criem OS sem seguir lock do Chamado; isso continua bloqueio de homologação. A mudança no wrapper 0611 pressupõe que ele não foi aplicado; caso já exista em ambiente, exige migration substitutiva. Gates e EXECUTE seguem fechados; testes/revisão adversarial obrigatórios.
