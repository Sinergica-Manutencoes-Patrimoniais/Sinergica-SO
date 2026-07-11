-- 0083_E01-S47_validar_funcionarios_user_type.sql — Sinérgica SO
-- Separada de 0082 para a validação não ocorrer na mesma transação do DDL.

alter table pcm.funcionarios
  validate constraint funcionarios_user_type_check;

-- Reverso: não aplicável; a constraint e o reverso estão em 0082.
