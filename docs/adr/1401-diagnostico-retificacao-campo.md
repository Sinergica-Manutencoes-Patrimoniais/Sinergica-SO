---
name: "docs-adr-1401-diagnostico-retificacao-campo-md"
description: "Documento Sinérgica SO: ADR-1401 — Diagnóstico de retificação de origem"
alwaysApply: false
---

# ADR-1401 — Diagnóstico de retificação de origem

O PCM autorizado consulta se um envelope possui recepção ou processamento conhecido para a mesma tarefa, sem expor dados de outros Clientes. A indicação é informativa e sujeita a concorrência; as guardas transacionais continuam sendo a autoridade. A consulta não altera histórico, executa evento ou libera retificação por si só.

Gate fechado; validar privilégios, revogação, isolamento, carga, concorrência, privacidade e revisão adversarial antes da ativação.
