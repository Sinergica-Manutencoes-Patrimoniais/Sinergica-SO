-- 0021_E01-S13_service_role_config_usuarios.sql — Sinérgica SO
-- Story E01-S13: o import Auvo → PCM roda como Edge Function interna (`service_role`) e precisa
-- preencher `pcm.clientes.created_by` com um usuário real já provisionado em `config.usuarios`.
-- RLS continua aplicada aos usuários finais; este GRANT é só para backend privilegiado.
--
-- Rollback:
--   revoke select on config.usuarios from service_role;
--   revoke usage on schema config from service_role;

grant usage on schema config to service_role;
grant select on config.usuarios to service_role;
