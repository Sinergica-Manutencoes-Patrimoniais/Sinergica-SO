-- 0109_E04-S04_validar_constraint_contrato.sql
-- Valida a constraint NOT VALID de 0108 (padrão split da casa — evita lock longo na migration que
-- adiciona a constraint; VALIDATE roda separado, sem bloquear escrita durante o scan).
-- Reverso: nada a fazer; dropar a constraint via reverso de 0108 já cobre o rollback completo.

alter table financeiro.lancamentos validate constraint lancamentos_contrato_id_fkey;
