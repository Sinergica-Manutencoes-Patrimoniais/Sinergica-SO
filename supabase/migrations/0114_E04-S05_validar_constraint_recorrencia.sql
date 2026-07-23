-- 0114_E04-S05_validar_constraint_recorrencia.sql
-- Valida a constraint NOT VALID de 0113 (padrão split da casa).
-- Reverso: nada a fazer; reverso de 0113 já cobre o rollback completo.

alter table financeiro.lancamentos validate constraint lancamentos_recorrencia_id_fkey;
