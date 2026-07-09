-- 0070_E01-S38_enriquece_ordens_servico_auvo.sql — Sinérgica SO
-- Kanban/timeline/calendário de OS (E01-S38): guarda técnico responsável, data agendada e
-- check-in/check-out reais da tarefa Auvo — hoje descartados no pull/webhook (confirmado contra a
-- API real, GET /tasks). Colunas próprias só pro que filtra/ordena/agrupa nas 3 visões novas
-- (timeline agrupa por técnico e posiciona por check-in/check-out; calendário posiciona por
-- data_agendada); todo o resto do dado rico da tarefa (endereço, lat/long, prioridade Auvo,
-- produtos/serviços, assinatura, anexos) vai em `auvo_detalhes` (jsonb) — decisão confirmada com
-- Lucas (2026-07-09) pra não pedir migration nova a cada campo novo exibido no card.
--
-- Colunas novas, todas nullable (OS manual sem tarefa Auvo simplesmente não preenche) — sem risco
-- de violar dado existente, sem precisar de NOT VALID.
--
-- NOT VALID aqui, VALIDATE CONSTRAINT na migration seguinte (0071) — Squawk (FK trava as duas
-- tabelas pra validar; mesmo padrão de 0004/0005, 0006/0007, 0043/0045).
--
-- Reverso:
--   drop index if exists pcm.idx_os_tecnico_funcionario;
--   drop index if exists pcm.idx_os_data_agendada;
--   alter table pcm.ordens_servico
--     drop constraint if exists ordens_servico_tecnico_funcionario_id_fkey,
--     drop column if exists tecnico_auvo_user_id,
--     drop column if exists tecnico_funcionario_id,
--     drop column if exists data_agendada,
--     drop column if exists check_in_at,
--     drop column if exists check_out_at,
--     drop column if exists auvo_detalhes;

alter table pcm.ordens_servico
  add column if not exists tecnico_auvo_user_id bigint,
  add column if not exists tecnico_funcionario_id uuid,
  add column if not exists data_agendada timestamptz,
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz,
  add column if not exists auvo_detalhes jsonb;

alter table pcm.ordens_servico add constraint ordens_servico_tecnico_funcionario_id_fkey
  foreign key (tecnico_funcionario_id) references pcm.funcionarios(id) not valid;

create index if not exists idx_os_tecnico_funcionario on pcm.ordens_servico (tecnico_funcionario_id);
create index if not exists idx_os_data_agendada on pcm.ordens_servico (data_agendada);

comment on column pcm.ordens_servico.tecnico_auvo_user_id is 'idUserTo bruto da tarefa Auvo — preenchido mesmo se funcionário ainda não sincronizado localmente.';
comment on column pcm.ordens_servico.tecnico_funcionario_id is 'Resolvido via pcm.funcionarios.auvo_user_id — null até o funcionário ser sincronizado.';
comment on column pcm.ordens_servico.auvo_detalhes is 'Dado rico da tarefa Auvo só pra exibição (endereço, lat/long, prioridade Auvo, produtos/serviços, assinatura, anexos) — nunca usado em WHERE/ORDER BY/GROUP BY. Campo novo do Auvo não pede migration, só ajuste de leitura no frontend.';
