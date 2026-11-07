---
name: "docs-adr-1051-varredura-local-reconciliacao-md"
description: "Documento Sinérgica SO: ADR-1051 — Registro de observações da fila para reconciliação"
alwaysApply: false
---

# ADR-1051 — Registro de observações da fila para reconciliação

**Status:** preparação privada, não homologada.

Adicionar ocorrência única por item de outbox e eventos imutáveis de mudança observada para Sistemas e Componentes cujo Cliente seja comprovado. Uma varredura explícita recebe até 50 IDs, deriva os fatos da fila sob locks e registra apenas entidade, objeto, estado local e número de tentativas. Reexecução com o mesmo requestId retorna o mesmo recibo; pedido divergente é recusado. Mudanças inexistentes não geram evento redundante. `processing` e `error` permanecem incertos, e `sent` é somente enviado não confirmado; nenhum estado local declara sucesso remoto, ausência de efeito ou resolução.

Cliente e origem são verificados no servidor; usuário precisa de `integracao.reconciliar`. O fluxo não chama Auvo, não altera a outbox, não reprocessa, não fecha ocorrência automaticamente e não acessa payload ou segredo. Gate próprio e da reconciliação nascem/permanecem fechados; RPC privada. A integração é um início para varredura periódica, ainda sem agendador, mecanismo de fechamento comprovado ou suporte a OS, Comercial e Financeiro.

Antes de liberar: verificar transferência de Cliente, todos os escritores/locks, autorização e revogação, concorrência, idempotência, RLS/FORCE, retenção, ordenação, volume e revisão adversarial. Nenhum cron, deploy ou envio externo é autorizado por esta preparação.
