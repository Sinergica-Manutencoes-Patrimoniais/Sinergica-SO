-- 0048_E02-S08_validar_fks_relacionamento.sql — Sinérgica SO
-- Validação separada das FKs adicionadas como NOT VALID em `0047`, seguindo o padrão anti-lock.
--
-- Reverso:
--   -- sem reverso destrutivo; as constraints são criadas em 0047.

alter table atendimento.conversas validate constraint conversas_contato_id_fkey;
alter table atendimento.conversas validate constraint conversas_lead_id_fkey;
alter table comercial.leads validate constraint leads_contato_id_fkey;
