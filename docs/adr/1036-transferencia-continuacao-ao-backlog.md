---
name: "docs-adr-1036-transferencia-continuacao-ao-backlog-md"
description: "Documento Sinérgica SO: ADR-1036 — Estado explícito da continuidade devolvida"
alwaysApply: false
---

# ADR-1036 — Estado explícito da continuidade devolvida

Status: preparação local, não aplicada nem testada.

Quando o restante de uma proposta tiver retorno parcial **promovido**, o PCM pode registrar que a continuidade foi transferida ao Backlog. A promoção exige proposta pendente e fotografia original; por isso a transição não é permitida enquanto o retorno aguarda promoção. A proposta passa para `devolvida_backlog`, sem criar OS, apagar histórico ou afirmar que a parcela foi atendida. A transição exige revisão do Chamado, identidade, permissões, motivo, fotografia da proposta e retorno correspondente. O recibo e a auditoria são imutáveis; o trigger permite apenas esta alteração autorizada e mantém a proposta protegida contra outras mudanças.

Esta transição não autoriza encerramento do Chamado nem comprova parada remota. A parcela e os demais critérios continuam em sua própria validação. O novo valor exige inventário e adaptação de todos os consumidores e constraints antes da aplicação, especialmente diagnóstico e encerramento. Testar lock, retry, simultaneidade com promoção, revisão, RLS/FORCE, rollback e revisão adversarial; gate e EXECUTE permanecem fechados.
