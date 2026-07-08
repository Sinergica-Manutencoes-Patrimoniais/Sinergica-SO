-- 0049_E02-S08_grant_service_role_comercial.sql — Sinérgica SO
-- Hotfix CI/pgTAP: E02-S08 concede INSERT/UPDATE em `comercial.leads` para `service_role`,
-- mas faltava USAGE no schema `comercial`. Sem isso, o Postgres falha antes de chegar na tabela:
-- "permission denied for schema comercial".
--
-- Reverso:
--   revoke usage on schema comercial from service_role;

grant usage on schema comercial to service_role;
