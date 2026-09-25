-- 0211_E01-S153_os_equipamento_alvo.sql — Sinérgica SO
-- Story E01-S153 (follow-up da E01-S76). OS ganha vínculo opcional a um Equipamento (Item) — o
-- "Alvo" escolhido na abertura, usado como `equipmentId` ao criar a task no Auvo
-- (pcm-auvo-create-task). NOT VALID: pcm.ordens_servico tem dados de produção (mesmo padrão de
-- 0095/0096) — coluna nova nasce NULL em toda linha existente, então a FK é satisfeita
-- trivialmente; VALIDATE roda na migration seguinte (0212) fora do lock de escrita.
--
-- Reverso:
--   alter table pcm.ordens_servico drop constraint if exists fk_ordens_servico_equipamento;
--   drop index if exists pcm.idx_ordens_servico_equipamento;
--   alter table pcm.ordens_servico drop column if exists equipamento_id;

alter table pcm.ordens_servico add column if not exists equipamento_id uuid;

alter table pcm.ordens_servico
  add constraint fk_ordens_servico_equipamento
  foreign key (equipamento_id) references pcm.equipamentos (id) not valid;

create index if not exists idx_ordens_servico_equipamento
  on pcm.ordens_servico (equipamento_id) where deleted_at is null;

comment on column pcm.ordens_servico.equipamento_id is
  'E01-S153: Equipamento (Item) alvo da OS, opcional — resolvido para auvo_equipment_id e enviado como equipmentId ao criar a task no Auvo (pcm-auvo-create-task).';
