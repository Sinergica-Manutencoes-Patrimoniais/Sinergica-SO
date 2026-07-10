-- 0073_E01-S40_tipo_tarefa_id_ordens_servico.sql — Sinérgica SO
-- O tipo de tarefa escolhido no modal de Nova OS (E01-S39 já lê a lista real de
-- `pcm.tipos_tarefa`) nunca chegava no Auvo — virava texto solto em `descricao`. Coluna própria
-- pra guardar a escolha estruturada e permitir que `pcm-auvo-create-task` resolva o `taskTypeId`
-- real a partir dela (fallback pro mapa hardcoded por categoria continua existindo).
--
-- Nullable — OS antiga/import de tarefa Auvo existente não tem essa escolha, sem risco de violar
-- dado existente. NOT VALID aqui, VALIDATE CONSTRAINT na migration seguinte (0074) — mesmo padrão
-- de 0070/0071 (E01-S38).
--
-- Reverso:
--   drop index if exists pcm.idx_os_tipo_tarefa;
--   alter table pcm.ordens_servico
--     drop constraint if exists ordens_servico_tipo_tarefa_id_fkey,
--     drop column if exists tipo_tarefa_id;

alter table pcm.ordens_servico add column if not exists tipo_tarefa_id uuid;

alter table pcm.ordens_servico add constraint ordens_servico_tipo_tarefa_id_fkey
  foreign key (tipo_tarefa_id) references pcm.tipos_tarefa(id) not valid;

create index if not exists idx_os_tipo_tarefa on pcm.ordens_servico (tipo_tarefa_id);

comment on column pcm.ordens_servico.tipo_tarefa_id is 'Tipo de tarefa escolhido na criação da OS (pcm.tipos_tarefa) — usado por pcm-auvo-create-task pra resolver o taskTypeId real no Auvo, com fallback pro mapa por categoria quando null.';
