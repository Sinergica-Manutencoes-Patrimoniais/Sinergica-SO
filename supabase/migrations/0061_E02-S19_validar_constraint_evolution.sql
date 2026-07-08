-- 0061_E02-S19_validar_constraint_evolution.sql — Sinérgica SO
-- Valida a constraint NOT VALID de 0060 (padrão do projeto).
--
-- Reverso: não aplicável (VALIDATE CONSTRAINT não tem reverso; a constraint em si reverte em 0060).

alter table atendimento.canais_externos validate constraint canais_externos_tipo_check;
