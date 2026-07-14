-- 0093_E01-S73_fix_grant_sequences_codigo.sql — Sinérgica SO
-- Achado em teste Playwright contra produção (2026-07-14): criar inspeção real falhou com
-- "permission denied for sequence inspecao_codigo_seq" (42501). Causa: `create sequence` não
-- concede privilégio nenhum a `authenticated` por padrão no Postgres — só a tabela ganhou GRANT
-- (0091), a sequence usada pelo trigger `fn_gerar_codigo_inspecao` (nextval) ficou sem.
-- Mesmo gap existe em `pcm.ferramenta_unidade_codigo_seq` (0086, E01-S63) — usada direto no
-- DEFAULT da coluna `codigo`, roda com o privilégio de quem faz o INSERT (SECURITY INVOKER),
-- não do dono da tabela.
--
-- Reverso:
--   revoke usage, select on pcm.inspecao_codigo_seq from authenticated, service_role;
--   revoke usage, select on pcm.ferramenta_unidade_codigo_seq from authenticated, service_role;

grant usage, select on pcm.inspecao_codigo_seq to authenticated;
grant usage, select on pcm.inspecao_codigo_seq to service_role;
grant usage, select on pcm.ferramenta_unidade_codigo_seq to authenticated;
grant usage, select on pcm.ferramenta_unidade_codigo_seq to service_role;
