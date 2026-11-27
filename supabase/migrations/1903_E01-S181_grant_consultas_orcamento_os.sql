-- 1903_E01-S181_grant_consultas_orcamento_os.sql — DEF-12
--
-- Reverso:
--   revoke execute on function comercial.sso_listar_edicao_orcamentos_os(uuid,uuid,integer,uuid) from authenticated;
--   revoke execute on function comercial.sso_listar_oportunidades_orcamento(uuid,uuid) from authenticated;
--   revoke execute on function comercial.sso_orcamento_operacional_autorizado(uuid) from authenticated;
--   revoke execute on function comercial.sso_preco_orcamento_operacional(uuid) from authenticated;
--
-- Mesmo defeito que a 1833 já corrigiu para a dispensa de orçamento, agora nas consultas do painel
-- de orçamento do detalhe da OS: as funções nasceram revogadas de `authenticated` (0353, 0386,
-- 0396, 0449) e nenhuma migration jamais concedeu execução; não existe wrapper `_mediada` que as
-- cubra. A UI chama as quatro direto, e o teste de componente não pega porque mocka o cliente
-- Supabase. Em ambiente real toda abertura do painel responde 42501 — é o que a homologação viu:
-- "falhas de consulta de orçamentos e oportunidades/listas autorizadas" no detalhe da OS.
--
--   comercial.sso_listar_edicao_orcamentos_os  → lista "Orçamentos operacionais da OS"
--   comercial.sso_listar_oportunidades_orcamento → seletor de oportunidade em "Criar orçamento"
--   comercial.sso_orcamento_operacional_autorizado → abre a composição de um orçamento
--   comercial.sso_preco_orcamento_operacional → preço/versão da composição
--
-- As duas últimas não apareceram no relatório porque não havia orçamento de teste na OS: sem
-- proposta, a tela nunca chega a chamá-las. Falham pelo mesmo motivo assim que houver uma.
--
-- Nenhuma regra de acesso é afastada. As quatro são `security definer` e checam, por conta
-- própria, config.sso_autorizar_acao (`material.gerir`/`custo.ler`, e `orcamento.emitir` nas de
-- proposta) para o cliente da OS, levantando 42501 quando falta concessão — direto ou pelas
-- funções internas sso_listar_orcamentos_os e sso_orcamento_sem_oportunidade, que permanecem
-- privadas. O que muda é só o direito de chamar a função.
--
-- Aditiva, idempotente, sem DDL de tabela e sem tocar em dado.

grant execute on function comercial.sso_listar_edicao_orcamentos_os(uuid,uuid,integer,uuid) to authenticated;
grant execute on function comercial.sso_listar_oportunidades_orcamento(uuid,uuid) to authenticated;
grant execute on function comercial.sso_orcamento_operacional_autorizado(uuid) to authenticated;
grant execute on function comercial.sso_preco_orcamento_operacional(uuid) to authenticated;

revoke all on function comercial.sso_listar_edicao_orcamentos_os(uuid,uuid,integer,uuid) from public, anon, service_role;
revoke all on function comercial.sso_listar_oportunidades_orcamento(uuid,uuid) from public, anon, service_role;
revoke all on function comercial.sso_orcamento_operacional_autorizado(uuid) from public, anon, service_role;
revoke all on function comercial.sso_preco_orcamento_operacional(uuid) from public, anon, service_role;
