# ADR-0213 — Triagem manual de intenção de OS enviada

Status: proposta, não homologada.

Operador com `visita.confirmar` e `integracao.reconciliar` pode anotar evidência manual e classificação declarada, ou descartar uma intenção interna ainda pendente com motivo, revisão e auditoria. A suposta correspondência da tarefa deve usar exatamente o ID anteriormente registrado, como texto. A evidência é declaração humana, não prova autenticada do destino, e não altera OS, vínculos ou tarefa nem confirma conciliação. Histórico é imutável; descarte não apaga evidências.

Não há contrato autenticado de leitura do Auvo nesta etapa: marcar como conciliada e mover OS permanecem bloqueados, mesmo diante de anotação manual. Faltam fonte verificável, fencing, sincronização do vínculo, proteção contra corrida com worker, tratamento de respostas tardias, testes e revisão adversarial. Gate e RPC continuam fechados.
