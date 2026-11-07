---
name: "docs-adr-0448-comparacao-calendario-legado-md"
description: "Documento Sinérgica SO: ADR-0448 — Comparação limitada de datas de recorrência"
alwaysApply: false
---

# ADR-0448 — Comparação limitada de datas de recorrência

Status: preparada, gate fechado, não aplicada nem homologada. Para relação declarada, Rotina por calendário de snapshot aprovado e janela de até 366 dias integralmente dentro da vigência, compara datas teóricas produzidas pelo cálculo SSO com a regra de semanas/meses do legado. Sem ciclos em qualquer lado o resultado é indeterminado.

Datas iguais na janela não provam equivalência geral, de alvo, contrato, feriados, execução, geração ou conteúdo. Não altera fontes nem geradores. A exatidão do cálculo legado, fronteiras, concorrência e autorizações exigem testes e revisão adversarial antes de habilitar.
