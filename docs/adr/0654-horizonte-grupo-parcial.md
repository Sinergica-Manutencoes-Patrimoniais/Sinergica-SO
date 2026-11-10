---
name: "docs-adr-0654-horizonte-grupo-parcial-md"
description: "Documento Sinérgica SO: ADR-0654 — Grupo no horizonte parcial de capacidade"
alwaysApply: false
---

# ADR-0654 — Grupo no horizonte parcial de capacidade

O horizonte reaproveita 0454 e percorre a fonte 0878 por semana, limitada a 10 mil registros. Soma somente esforços de Grupo com tempo conhecido e sem estimativa da OS na fonte; quando a OS tem estimativa, marca sobreposição e não soma o Grupo. Quantidades ausentes e truncamento são explícitos. O subtotal é apenas da fonte encontrada, não a demanda total.

Disponibilidade e demanda permanecem incompletas e saldo indeterminado, inclusive quando não houver linhas: a fonte só cobre Grupos com Visita e vínculo comprovados e não comprova ausência de outras demandas. A consulta não reserva capacidade, não altera dados e não muda o horizonte legado. Gates e permissões fechados; revisão de desempenho, concorrência, testes e homologação pendentes.
