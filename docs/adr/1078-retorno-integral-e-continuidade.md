# ADR-1078 — Retorno integral diante de continuidade da parcela

Status: proposta local, não aplicada nem homologada.

## Contexto

O comando de retorno integral usa a atribuição inicial e uma declaração de não execução. Uma OS de continuidade ou uma proposta vinculada pode representar trabalho anterior ou escopo restante. A declaração relativa à OS inicial, sozinha, não demonstra que toda a parcela permanece sem execução.

## Decisão

Depois de obter a trava do Chamado e verificar a parcela, o comando integral recusará quando houver vínculo de continuidade ou proposta de continuidade vinculada à mesma parcela. O operador deverá conferir o fluxo de retorno parcial existente; esta guarda não converte automaticamente o retorno nem determina quantidade executada. Mantêm-se recibos idempotentes já registrados, verificações existentes, permissões e gates. A recusa não apaga nem altera histórico.

## Limites

Inventariar todos os caminhos antigos que criam continuidade sem vínculo formal; a ausência de vínculo não prova ausência de execução. Verificar isolamento, concorrência, ordem de travas, replays, corridas com aprovação e os contratos de retorno parcial e promoção no esquema completo. Interfaces e mensagens precisam distinguir recusa de falha de transporte. Revisão adversarial obrigatória antes de habilitar; não aplicar ou enviar tarefas externas por esta decisão.
