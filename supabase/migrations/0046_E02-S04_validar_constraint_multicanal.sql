-- 0046_E02-S04_validar_constraint_multicanal.sql — Sinérgica SO
-- Validação separada do check multi-canal adicionado como NOT VALID em `0044`, seguindo o padrão
-- anti-lock de `0004`/`0005`.
--
-- Reverso:
--   -- sem reverso destrutivo; a constraint já existia em 0044.

alter table atendimento.conversas validate constraint conversas_canal_check;
