-- 0186_E03-S05_validar_constraint_motivo_assessment.sql — Sinérgica SO
-- Valida a constraint criada NOT VALID em 0185 — transação separada, mesmo padrão de 0091/0092.

alter table pcm.inspecoes validate constraint inspecoes_motivo_assessment_check;
