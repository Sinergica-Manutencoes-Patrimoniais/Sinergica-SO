-- 0014_E01-S13_grant_service_role_clientes.sql — Sinérgica SO
-- Story E01-S13 (import inicial de clientes Auvo → PCM). Só GRANT, nenhuma tabela/policy nova.
--
-- `pcm.clientes` existe desde `0001_E00-S00`; hoje só `authenticated` tem GRANT (`0002`, ajustado
-- por `0009` para checar `user_modulos->>'pcm'`). `service_role` já tem `usage on schema pcm`
-- (concedido em `0012_E01-S11`), mas `USAGE` no schema NÃO cascade para privilégio de tabela —
-- sem o GRANT abaixo, a Edge Function `pcm-auvo-customers-import` levaria
-- "permission denied for table clientes". Mesma classe de bug já corrigida 2x neste projeto
-- (0003/audit.events, 0010/config.grupos, 0012/schema pcm) — não repetir.
--
-- Nenhuma policy nova: `service_role` sempre bypassa RLS (é o papel de superusuário do Supabase
-- por design), então basta o GRANT de privilégio de tabela padrão do Postgres.
--
-- Reverso:
--   revoke select, insert, update on pcm.clientes from service_role;

grant select, insert, update on pcm.clientes to service_role;
