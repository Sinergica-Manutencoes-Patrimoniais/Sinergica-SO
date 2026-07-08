-- 0044_E02-S04_atendimento_multicanal.sql — Sinérgica SO
-- Multi-canal humano no Inbox de Atendimento. E02-S01 criou `conversas.canal` já prevendo o
-- campo, mas restringiu o check a 'whatsapp'. S04 libera Instagram/Messenger no modelo canônico
-- para o Inbox/Dashboard, mantendo a automação de IA fora desses canais.
--
-- Reverso:
--   alter table atendimento.conversas drop constraint if exists conversas_canal_check;
--   alter table atendimento.conversas add constraint conversas_canal_check
--     check (canal in ('whatsapp'));

alter table atendimento.conversas drop constraint if exists conversas_canal_check;
alter table atendimento.conversas add constraint conversas_canal_check
  check (canal in ('whatsapp', 'instagram', 'messenger')) not valid;
