-- 0005_E00-S08_validar_constraint_papel.sql — Sinérgica SO
-- Completa 0004: valida a constraint `usuarios_papel_check` (criada NOT VALID lá) numa transação
-- separada — Squawk `constraint-missing-not-valid` exige isso para não bloquear leitura durante
-- o table-scan de validação. Ver specs/E00-S08-renomear-papeis-rbac/spec.md.
--
-- Reverso: nenhum — validar uma constraint não é uma mudança reversível de schema por si só
-- (o reverso real é o `drop constraint` já documentado em 0004).

alter table config.usuarios validate constraint usuarios_papel_check;
