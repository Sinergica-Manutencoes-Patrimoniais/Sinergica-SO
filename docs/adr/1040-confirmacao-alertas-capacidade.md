---
name: "docs-adr-1040-confirmacao-alertas-capacidade-md"
description: "Documento Sinérgica SO: ADR-1040 — Confirmação declarada de alertas ao reprogramar"
alwaysApply: false
---

# ADR-1040 — Confirmação declarada de alertas ao reprogramar

Status: preparação local, sem aplicação ou testes; gate e execução fechados.

Uma entrada separada permite registrar, na mesma transação de reprogramação de Visita, os alertas informados a partir de uma simulação manual, o vencimento declarado e a justificativa. O comando verifica identidade, Cliente, capacidade, revisão, formato e repetição, e chama a transição proprietária existente; recibo e declaração são imutáveis. Não cria tarefa Auvo e não altera a data-base do Plano.

Os valores e alertas declarados não são dados oficiais, prova de capacidade, de simultaneidade ou de vencimento. Esta entrada não dispensa o cálculo e a cobertura das fontes reais nem impede acesso por outros caminhos legados. Antes de habilitar é obrigatório integrar os demais caminhos, definir cobertura dos alertas no servidor, demonstrar idempotência, locks, autorização/revogação, RLS/FORCE, privacidade e revisão adversarial. A confirmação não é prova de que não existam outros alertas.
