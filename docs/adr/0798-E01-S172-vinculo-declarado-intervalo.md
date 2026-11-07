---
name: "docs-adr-0798-e01-s172-vinculo-declarado-intervalo-md"
description: "Documento Sinérgica SO: ADR 0798 — Vínculo declarado de intervalo a total semanal"
alwaysApply: false
---

# ADR 0798 — Vínculo declarado de intervalo a total semanal

Status: proposta; não homologada.

## Decisão

O PCM poderá declarar ou retirar a afirmação de que um intervalo já compõe o total da mesma natureza (reserva ou ausência) na revisão atual da disponibilidade. A afirmação é uma evidência humana, não cálculo, prova de cobertura integral, duração correspondente, disponibilidade real ou saldo. Nenhum total é modificado. Intervalos antigos continuam visíveis como histórico; após revisão da disponibilidade, vínculos anteriores não são transpostos automaticamente.

Cada comando exige Cliente, autorização atual, revisão da disponibilidade e revisão esperada do vínculo; registra ator, motivo e requestId em eventos imutáveis. Repetição idêntica é idempotente; mesmo requestId divergente falha. Disponibilidade e intervalo devem pertencer ao mesmo Cliente e ao mesmo registro. A escrita serializa alterações da disponibilidade e do vínculo, e segue o protocolo de serialização de autorização sob READ COMMITTED. Gate próprio começa fechado; não há integração automática com o snapshot nem liberação para operação.

## Limites

Mesmo vínculo afirmativo não garante que os valores sejam iguais ou não se sobreponham a outros Clientes, nem que RH, períodos trabalháveis e demanda estejam completos. A composição efetiva, retificação dos intervalos, revisão adversarial, políticas de acesso e homologação permanecem pendentes. A solução é aditiva e não modifica cadastros ou histórico preexistentes.
