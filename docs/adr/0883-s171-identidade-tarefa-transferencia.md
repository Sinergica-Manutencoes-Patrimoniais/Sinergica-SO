# ADR-0883 — Conferência da identidade da tarefa antes da transferência

Data: 2026-10-30 · Status: proposta, não implantada · complementa ADR-0882

## Contexto

No clone diagnóstico, a tarefa Auvo da OS mudou enquanto a transferência aguardava a trava da OS. A 1067 aceitou a nova identidade e criou intenção com ela, embora o operador tivesse iniciado o pedido antes da mudança. Não houve envio remoto; o cenário mostra que a identidade conferida não participa do contrato.

## Decisão

Preparar consulta autenticada e mediada para exibir a identidade local da tarefa e o vínculo; não é prova de estado no Auvo. O pedido passa a carregar essa identidade em texto, sem perda de precisão. A nova entrada transacional trava e revalida a OS e o vínculo antes de delegar ao núcleo da 1067; uma identidade divergente recusa a operação. Retries idênticos usam o resultado original autorizado. Retirar EXECUTE de authenticated da entrada anterior, que não exige identidade, sem apagá-la.

Os gates continuam fechados. Autorizações e locks devem seguir a mesma ordem do núcleo; faltam prova de todos os escritores, concorrência, HTTP/ACL oficiais, revisão adversarial e compatibilidade de rollout. A identidade local não comprova existência, estado ou atualização da tarefa remota. Sem deploy ou Auvo real.
