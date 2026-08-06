-- E01-S125 — a abertura de task no Auvo deixa de ser efeito colateral de mudar a OS para
-- planejamento. A função é mantida temporariamente para rollback operacional/auditoria; só o
-- trigger assíncrono é removido. A abertura passa pela Edge Function autenticada
-- `pcm-auvo-open-task`, após dry-run e confirmação humana.
--
-- Reversão: recriar somente `trg_auvo_create_task_on_planejamento` apontando para
-- `pcm.fn_auvo_create_task_on_planejamento()`. Não recriar sem reaprovar ADR-0015.

drop trigger if exists trg_auvo_create_task_on_planejamento on pcm.ordens_servico;

comment on function pcm.fn_auvo_create_task_on_planejamento() is
  'Legado E01-S09: trigger removido pela E01-S125/ADR-0015. Nao reativar sem decisao explicita; abertura Auvo agora e sob demanda via pcm-auvo-open-task.';
