-- 0202_E03-S12_view_portal_orcamentos.sql — Sinérgica SO
-- Story E03-S12 (AC-3). O portal do cliente lia direto de `pcm.orcamentos_servico` (ver
-- apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts, colunas
-- id/numero/titulo/itens/valor_total_centavos/status/valido_ate, ordenado por created_at).
--
-- A RLS de `pcm.orcamentos_servico` (migration 0144) já concede select direto pro
-- cliente-sindico filtrado por `cliente_id = jwt.cliente_id` — diferente do caso de
-- `financeiro.portal_faturas`/`comercial.portal_propostas`, cuja RLS base NÃO permite o síndico
-- de jeito nenhum (precisam de `security_barrier` + filtro manual embutido na view). Aqui a RLS já
-- está correta, então a view roda `security_invoker = true`: herda a RLS de quem chama sem
-- duplicar o filtro (evita drift entre o filtro da view e a policy da tabela-base) — é uma janela
-- de leitura mais estreita (R2), não um mecanismo de bypass de RLS.
--
-- Comportamento visível ao síndico não muda (AC-5): mesmas colunas, mesmo filtro efetivo.
--
-- Reverso:
--   drop view if exists pcm.portal_orcamentos_servico;

create view pcm.portal_orcamentos_servico
with (security_invoker = true) as
select
  id,
  cliente_id,
  requisicao_id,
  numero,
  titulo,
  descricao,
  itens,
  valor_total_centavos,
  status,
  valido_ate,
  ordem_servico_id,
  created_at
from pcm.orcamentos_servico;

-- Bug real da E04-S04 (migration 0110): view sem `grant select` explícito derruba o portal mesmo
-- com RLS correta — PostgREST nega no nível de privilégio antes de a RLS ser avaliada.
grant select on pcm.portal_orcamentos_servico to authenticated;
