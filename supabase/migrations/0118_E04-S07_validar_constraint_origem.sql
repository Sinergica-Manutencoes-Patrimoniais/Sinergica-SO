-- 0118_E04-S07_validar_constraint_origem.sql
-- Valida a constraint NOT VALID de 0117 (padrão split da casa).
-- Reverso: nada a fazer; reverso de 0117 já cobre o rollback completo.

alter table financeiro.lancamentos validate constraint lancamentos_origem_check;
