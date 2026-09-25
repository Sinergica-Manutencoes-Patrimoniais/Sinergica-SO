-- 0213_E01-S153_sistemas_auvo_customer_id.sql — Sinérgica SO
-- Pré-condição documentada no design.md da E01-S76 pra ligar `writeEnabled:true` no descriptor de
-- Sistema (registry/sistemas.ts): sem `auvo_customer_id`, o Sistema subiria ao Auvo sem
-- `associatedCustomerId`. Coluna denormalizada, mesmo padrão de `pcm.equipamentos.auvo_customer_id`
-- (populada em app a partir de `pcm.clientes.auvo_id` — ver supabase-sistemas-adapter.ts).
--
-- Reverso: alter table pcm.sistemas drop column if exists auvo_customer_id;

alter table pcm.sistemas add column if not exists auvo_customer_id bigint;

comment on column pcm.sistemas.auvo_customer_id is
  'E01-S153: pré-condição do flip writeEnabled (design.md E01-S76) — mesmo padrão de pcm.equipamentos.auvo_customer_id, populado em app a partir de pcm.clientes.auvo_id.';

-- Backfill dos Sistemas já cadastrados (o app só popula essa coluna em criações/edições novas a
-- partir de agora — sem backfill, todo Sistema anterior a esta migration ficaria sem
-- associatedCustomerId quando o outbox represado drenar).
update pcm.sistemas s
set auvo_customer_id = c.auvo_id
from pcm.clientes c
where c.id = s.cliente_id
  and s.auvo_customer_id is null
  and c.auvo_id is not null;
