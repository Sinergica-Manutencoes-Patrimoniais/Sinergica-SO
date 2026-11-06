---
name: "docs-adr-0742-autorizacao-atual-recibo-foto-md"
description: "Documento Sinérgica SO: ADR 0742 — autorização atual no vínculo e recibo de foto"
alwaysApply: false
---

# ADR 0742 — autorização atual no vínculo e recibo de foto

## Problema

As funções da 0963 verificam autorização em snapshots potencialmente anteriores à revogação. Em REPEATABLE READ foi reproduzida a entrega do recibo após a revogação efetiva. A função de recibo é STABLE e mantém snapshot da instrução até em READ COMMITTED; apenas adquirir um lock não atualizaria esse snapshot.

## Decisão

Antes de consultar autorização ou gates, exigir READ COMMITTED e adquirir sem espera o lock compartilhado do protocolo de autorização da 0319. Recusar com 25001 outros isolamentos e com 55P03 alteração de autorização em curso. Ler ambos gates com FOR SHARE, mantendo seus locks até o término da transação e recusando gates desativados. Alterar o recibo para VOLATILE, permitindo snapshot novo por comando PL/pgSQL; preservar assinatura, ACL, proprietário, parâmetros e dados. O lock de autorização também persiste até término da transação. Esta medida cobre somente as fontes protegidas pelos gatilhos da 0319; não comprova revogação externa de token. Não habilitar rollout antes de testar corridas de gates e revisar o fluxo completo.

## Compatibilidade e reversão

Clientes que usam REPEATABLE READ ou SERIALIZABLE passam a receber 25001 e devem usar READ COMMITTED. A aplicação da 0964 é aditiva, sem alteração de dados; reverter as definições à 0963 reabre a falha e exige manter gates desativados. O caminho legado e o núcleo de vínculo continuam sem privilégios diretos ao navegador. Homologação e deploy dependem de testes reais e revisão adversarial.
