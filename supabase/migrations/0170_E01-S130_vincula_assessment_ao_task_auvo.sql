-- 0170_E01-S130_vincula_assessment_ao_task_auvo.sql
-- O item importado guarda a tarefa-fonte para o webhook localizar e reclassificar somente o
-- assessment provisório correto. O backfill cobre a chave que E01-S98 já gravava.

update pcm.inspecao_itens
set auvo_task_id = (substring(auvo_questao_chave from '^auvo-task-([0-9]+)-'))::bigint
where auvo_task_id is null
  and auvo_questao_chave ~ '^auvo-task-[0-9]+-';

create index if not exists idx_inspecao_itens_auvo_task_provisorio
  on pcm.inspecao_itens (auvo_task_id, inspecao_id, ordem)
  where auvo_importacao_provisoria;
