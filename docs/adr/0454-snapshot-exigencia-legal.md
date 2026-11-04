# ADR-0454 — Congelamento de exigência declarada

Status: preparado, gate desligado, não aplicado nem homologado. Em novas aprovações, o trigger registra no snapshot a última declaração por Rotina, ou indeterminada se ausente, preservando referência, justificativa, revisão e ator. Mudança de modo/tolerâncias após declaração exige reconferência. Referência e tolerância nunca são consideradas automaticamente validadas; não transforma Visita em calendário. Snapshots históricos anteriores não são modificados.

A classificação não demonstra conformidade normativa nem valida conteúdo da referência. Ordem e interação dos triggers, concorrência, cópia para revisões e consumo em execução exigem implementação ou revisão adicional, testes e revisão adversarial; gate e privilégios permanecem fechados.
