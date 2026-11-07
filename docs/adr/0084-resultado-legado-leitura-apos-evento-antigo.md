---
name: "docs-adr-0084-resultado-legado-leitura-apos-evento-antigo-md"
description: "Documento Sinérgica SO: ADR-0084 — Verificação de origem antes do resultado legado"
alwaysApply: false
---

# ADR-0084 — Verificação de origem antes do resultado legado

## Decisão

`pcm.atualizar_resultado_preventiva` deve bloquear e conferir a Ocorrência antes de avaliar a idade do evento. Mesmo quando o evento não atualiza o dado por ser antigo, a função privilegiada não deve retornar resultado de outra origem. Falha com `23514` para origem incompatível; mantém `P0002` para Ocorrência inexistente, a autorização de service role e o comportamento monotônico legado.

O bloqueio serializa verificações e atualização da mesma Ocorrência. Requer 0304 e mantém o trigger defensivo de 0306. Não substitui autorização por Cliente nas funções externas nem habilita origem nova. Avaliar impacto de lock e revisar concorrência antes de rollout.
