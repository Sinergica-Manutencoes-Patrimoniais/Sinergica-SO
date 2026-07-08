-- 0055_E02-S14_validar_constraint_vendas.sql — Sinérgica SO
-- Valida a constraint NOT VALID de 0054 (padrão do projeto: adicionar sem lock total, validar
-- depois). Tabela pequena/nova — validação é instantânea, sem risco de lock longo.
--
-- Reverso: não aplicável (VALIDATE CONSTRAINT não tem reverso; a constraint em si reverte em 0054).

alter table atendimento.personas validate constraint personas_vendas_exige_tool_use;
