---
name: "docs-adr-1538-reabrir-grupo-fila-md"
description: "Documento Sinérgica SO: ADR-1538 — Reabrir conferência de Grupo na fila"
alwaysApply: false
---

# ADR-1538 — Reabrir conferência de Grupo na fila

## Contexto
Uma declaração PCM de Grupo pode ficar obsoleta após a fila ser confirmada como aguardando. Cancelar a fila é irreversível e não representa a necessidade de nova conferência.

## Decisão
Permitir ao PCM, por comando explícito, auditado e idempotente, mover a entrada de Grupo de aguardando para verificação quando a fotografia declarada já não for atual. A operação usa a revisão da fila e o lock de ciclo, preserva a ocorrência e não altera Chamado, OS ou tarefas. A reconfirmação continua exigindo nova declaração humana e as guardas de origem/vigência existentes. Calendário e Visita têm suporte, sem novos gates.

Para novo Chamado de calendário ligado a Grupo com entrada em fila, exigir que esteja aguardando e sua declaração permaneça atual. O caminho por Visita já realiza a mesma checagem da fonte; replay e Chamado existente permanecem preservados. Não se presume ausência de execução externa.

## Limites
O controle cobre consumidores ligados a esses comandos, não todos os escritores legados; exige testes de concorrência, permissões reais e revisão adversarial antes de habilitar. Nenhuma tarefa Auvo é enviada.
