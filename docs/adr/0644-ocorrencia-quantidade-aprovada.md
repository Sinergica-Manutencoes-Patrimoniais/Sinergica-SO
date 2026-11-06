---
name: "docs-adr-0644-ocorrencia-quantidade-aprovada-md"
description: "Documento Sinérgica SO: ADR-0644 — Quantidade aprovada na ocorrência de Grupo"
alwaysApply: false
---

# ADR-0644 — Quantidade aprovada na ocorrência de Grupo

Sob gate desligado, o registro 0815 exige snapshot de quantidade de Grupo único e válido da versão aprovada, usa quantidade e revisão da aprovação e registra separadamente a fotografia atual no momento do registro. A quantidade atual não substitui a aprovada; registros anteriores não são alterados. Sem snapshot, a nova operação falha fechada e não inventa dados. O comportamento anterior é preservado com gate desligado.

O diagnóstico 0864 ainda precisa distinguir a origem de fotografias anteriores e novas. A aprovação pode ter vigência futura e a quantidade atual pode divergir; nenhuma execução ou OS é criada. Concorrência global, testes e homologação seguem pendentes.
