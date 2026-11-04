# ADR-1364 — Consulta direta da entrada preventiva

**Estado:** proposta; não aplicada nem homologada.

## Contexto e decisão

A gestão de uma ocorrência percorre todas as páginas da fila do Plano antes de habilitar a ação. Para filas extensas, isso exige múltiplas consultas manuais e dificulta o trabalho do PCM.

Adicionar consulta por Cliente, Plano e ocorrência preparada, preservando o gate e a capacidade `plano.gerir`. A consulta valida pertencimento, respeita a autorização atual e devolve no máximo duas entradas: duas indicam ambiguidade e bloqueiam ações. A ausência de entrada para a ocorrência consultada não comprova ausência de outro registro para o mesmo ciclo em outra versão; a escrita continua revalidando a identidade canônica e a revisão.

## Limites

Não cria, cancela ou altera entrada, OS, fonte preventiva ou tarefa externa. Antes da ativação, validar ACL, RLS/FORCE, revogação, locks, índices, concorrência com mudança de vínculo, diferenças entre versões e revisão adversarial. A consulta não conclui a fila operacional completa.
