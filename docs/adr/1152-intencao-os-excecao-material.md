# ADR-1152 — Origem de material na intenção de reprogramação

Status: proposta local, não aplicada nem homologada.

Permitir que o PCM registre uma intenção de reprogramar OS já enviada com vínculo explícito a uma exceção de material da mesma OS e Cliente. O comando existente de Visita é reutilizado na mesma transação; depois se confere a exceção imutável e se grava vínculo auditável, sem alterar a OS ou tarefa remota. O mesmo requestId não pode ser reaproveitado para anexar uma exceção a uma intenção genérica anterior. Repetição idêntica devolve o recibo anterior; outra exceção ou payload gera conflito.

A proteção de Visita e a capacidade `material.gerir` devem estar efetivas; a captura não prova que a exceção continua aberta. A obtenção de trava na lista é não bloqueante, pois o comando de Visita já tomou travas de OS e o fluxo de materiais pode tomá-las em ordem inversa. Falha desfaz a intenção inteira. Gate nasce fechado; execução e interface não são concedidas até comprovar concorrência, revogação, isolamento, FORCE RLS, compatibilidade e revisão adversarial. A reprogramação efetiva e a integração Auvo continuam pendentes.
