-- 0101_E01-S07_hub_de_os.sql — Sinérgica SO
-- Hub de OS (fila unificada C1/C2/P1/P2/IN) — estende pcm.ordens_servico em vez de criar tabela
-- nova (ADR-0010/design.md de E01-S07). `tipo_os` é inferido de `categoria` na criação (domínio) e
-- gravado; a PRIORIDADE do Hub nunca é gravada — é sempre calculada em runtime a partir de
-- `tipo_os`+`data_agendada` (evita cron de "promoção" e staleness). `pmoc_schedule_id` prepara o
-- vínculo OS↔cronograma PMOC para quando a Edge Function produtora (pmoc-auvo-create-os, deferida)
-- existir — nenhum código grava esta coluna ainda.
--
-- Reverso:
--   alter table pcm.ordens_servico
--     drop constraint if exists ordens_servico_pmoc_schedule_id_fkey,
--     drop constraint if exists ordens_servico_tipo_os_check,
--     drop column if exists tipo_os,
--     drop column if exists pmoc_schedule_id;

alter table pcm.ordens_servico add column if not exists tipo_os text;
alter table pcm.ordens_servico add column if not exists pmoc_schedule_id uuid;

alter table pcm.ordens_servico
  add constraint ordens_servico_tipo_os_check
  check (tipo_os is null or tipo_os in ('C1', 'C2', 'P1', 'P2', 'IN'))
  not valid;

alter table pcm.ordens_servico
  add constraint ordens_servico_pmoc_schedule_id_fkey
  foreign key (pmoc_schedule_id) references pcm.pmoc_schedules (id) not valid;

create index if not exists idx_os_tipo_os on pcm.ordens_servico (tipo_os) where tipo_os is not null;

comment on column pcm.ordens_servico.tipo_os is
  'Tipo do Hub de OS (C1 emergencial/C2 corretiva/P1 preventiva PMOC/P2 preventiva predial/IN inspeção). Inferido de categoria na criação (domain/hub-os.ts), editável manualmente depois. Prioridade NUNCA é gravada — sempre calculada (calcularPrioridadeHub).';
comment on column pcm.ordens_servico.pmoc_schedule_id is
  'Vínculo com o cronograma PMOC que originou esta OS (E01-S07). Coluna pronta; produtor real é a Edge Function pmoc-auvo-create-os, ainda não construída (deferida, bloco S05/cron).';
