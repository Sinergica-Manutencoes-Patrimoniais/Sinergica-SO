-- 0110_E04-S04_grant_aging_recebiveis.sql
-- Bug real achado via Playwright contra produção: a view financeiro.aging_recebiveis (0108) tinha
-- security_invoker=on mas nenhum GRANT SELECT — views não herdam o grant da tabela base, PostgREST
-- negava com 42501 mesmo a RLS de financeiro.lancamentos permitindo. ContasReceberPage carregava
-- "Algo deu errado / Falha ao carregar contas a receber." pra qualquer usuário.
-- Reverso: revoke select on financeiro.aging_recebiveis from authenticated;

grant select on financeiro.aging_recebiveis to authenticated;
