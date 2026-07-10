-- 0075_E01-S51_detalhes_clientes.sql — Sinérgica SO
-- Cliente-360 mais rico: mesmo padrão do `auvo_detalhes` de OS (E01-S38, migration 0070) — colunas
-- próprias só pro que filtra/ordena (já existem: cidade/estado/cep/status_comercial/etc., migration
-- 0022), jsonb pro resto (payload rico do Auvo que hoje é descartado, ex.: `contacts[]` completo —
-- `fromAuvo` só usa `contacts[0]`). Nullable puro, sem FK — nunca usado em WHERE/ORDER BY/GROUP BY.
--
-- Reverso:
--   alter table pcm.clientes drop column if exists detalhes;

alter table pcm.clientes add column if not exists detalhes jsonb;

comment on column pcm.clientes.detalhes is 'Dado rico do cliente Auvo só pra exibição (ex.: contacts[] completo — hoje só o [0] vira colunas contato_*) — nunca usado em WHERE/ORDER BY/GROUP BY. Campo novo do Auvo não pede migration, só ajuste de leitura no frontend.';
