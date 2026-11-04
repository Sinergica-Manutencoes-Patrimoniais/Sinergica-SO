# ADR-0848 — Proteção da origem legada da OS após retorno

## Contexto

Em clone sintético, aprovação de retorno e geração de Pendência coexistiram com alteração posterior de `ordens_servico.ocorrencia_preventiva_id` pela role `authenticated`, com JWT de superadmin e RLS. O histórico da Pendência manteve a ocorrência antiga, enquanto a OS passou a apontar para outra origem. Na ordem concorrente testada a atualização aguardou a aprovação, mas foi aceita depois do commit. No banco diagnóstico com fixture revertida, a mesma role alterou também `client_id` e `auvo_task_id`, cada um com `RETURNING` confirmando uma linha afetada.

## Decisão

Preparar trigger aditivo sob gate próprio inicialmente fechado. Enquanto habilitado, recusar mudança de `ocorrencia_preventiva_id`, `client_id`, `auvo_task_id`, `sistema_id` ou `equipamento_id` de OS que já tenha retorno preparado. Alterações em outros campos e updates que mantenham os cinco valores continuam permitidos; OS sem retorno não são bloqueadas por esta regra. A trava compartilhada no gate impede desativação concorrente antes do commit. O histórico existente não é reescrito.

## Impacto e limites

Escritores diretos e RPCs que alterem esses cinco campos após retorno passarão a receber erro; devem ser inventariados e substituídos por fluxo explícito de reconciliação antes de habilitar. Com gate desligado, o teste autenticado alterou Sistema e Equipamento em uma linha cada. A busca inicial por updates explícitos de ocorrência não encontrou escritores em migrations ou frontend, mas não cobre SQL dinâmico, sistemas externos ou funções em produção. `pcm-auvo-create-task` e `pcm-preventivas-confirmar` escrevem `auvo_task_id`; seus caminhos de retry e reconciliação precisam ser revisados antes de habilitar. Classificação normal 0402 trava a OS; outros produtores de retorno e origens Grupo/Visita requerem análise de concorrência e revisão adversarial. A regra não cobre exclusão, outras origens ou históricos já inconsistentes. Nenhum gate é habilitado por esta migration.
