-- 0003_E00-S07_audit_events_grant.sql — Sinérgica SO
-- Story E00-S07 (hardening pós-primeira-pipeline-real). Achado pelo novo
-- scripts/lint-migrations.mjs: audit.events (criada em 0001_E00-S00_schemas_dominio.sql) tem
-- policies de "deny update"/"deny delete", mas NUNCA recebeu GRANT nenhum — sem GRANT USAGE ON
-- SCHEMA e GRANT na tabela, nenhum role (nem service_role) consegue gravar evento de auditoria.
-- 0001 já foi aplicada em produção e nunca é editada (ver AGENTS.md/convenção do projeto) — a
-- correção vem aqui, nova migration aditiva.
--
-- Reverso:
--   revoke all on audit.events from service_role;
--   revoke usage on schema audit from service_role;
--
-- Decisão: audit.events é append-only e escrito pelo BACKEND (Edge Functions/service_role), nunca
-- diretamente pelo client — por isso o GRANT é só para service_role (que ignora RLS via
-- bypassrls, mas ainda precisa do privilégio de tabela/schema como qualquer role). `authenticated`
-- e `anon` continuam sem nenhum acesso a audit.events (nem SELECT) — não há policy de leitura
-- para eles, e agora também não há GRANT, reforçando o deny by default.

grant usage on schema audit to service_role;
grant select, insert on audit.events to service_role;
-- Sem update/delete mesmo para service_role — reforça as policies "deny update"/"deny delete"
-- já existentes com o privilégio de base também negado (defesa em profundidade).
