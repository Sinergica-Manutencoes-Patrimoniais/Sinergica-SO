---
name: "docs-adr-1128-movimentacao-ocorrencia-visita-md"
description: "Documento Sinérgica SO: ADR-1128 — Movimentação de Visita com ocorrência preparada"
alwaysApply: false
---

# ADR-1128 — Movimentação de Visita com ocorrência preparada

Status: proposta local, não aplicada nem homologada.

Ao mudar o dia contratual para data sem feriado, uma Visita futura não confirmada pode ser movida com ocorrências preparadas somente quando não houver vínculos de OS, legado, materialização, ciclo ou Grupo. O comando mantém o vencimento original e os identificadores, registra a nova programação para cada ocorrência e usa as mesmas travas dos escritores de vínculos. A alteração da regra, Visita e histórico deve ser atômica.

A nova programação não comprova execução nem altera o vencimento histórico. Os demais consumidores precisam distinguir vencimento e data programada; ocorrências já vinculadas exigem reconciliação. O gate permanece fechado até testes de concorrência, original/replay, limites, fuso, projeções, RLS e revisão adversarial.
