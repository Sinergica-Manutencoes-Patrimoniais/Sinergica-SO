-- 0112_E04-S02_validar_constraint_extrato.sql
-- Valida a constraint NOT VALID de 0111 (padrão split da casa — ver 0101/0102, 0108/0109).
-- Reverso: nada a fazer; reverso de 0111 já cobre o rollback completo.

alter table financeiro.lancamentos validate constraint lancamentos_extrato_transacao_id_fkey;
