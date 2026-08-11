-- 0188_E03-S06_portal_propostas.sql — Sinérgica SO
-- Story E03-S06, AC-3/AC-4. View restrita pro síndico ver as propostas da PRÓPRIA Conta — mesmo
-- padrão de `financeiro.portal_faturas`/`portal_cobrancas` (E09-S10, migration 0145): filtro
-- embutido na própria view (cliente_id do claim + user_role='cliente-sindico'), não
-- `security_invoker` — a RLS normal de `comercial.propostas` exige módulo `comercial`, que o
-- síndico nunca tem, então herdar a RLS quebraria o portal por completo.
--
-- `propostas` não tem `cliente_id` direto — vem de `oportunidades.cliente_id` (join). Só os status
-- que já saíram de rascunho aparecem (AC-4): `rascunho`/`em_revisao`/`cancelada` NUNCA vazam pro
-- portal, mesmo que o filtro de cliente bata.
--
-- ⚠️ LEMBRETE (bug real da E04-S04, migration 0110): view não herda GRANT da tabela-base — precisa
-- de `grant select` explícito, senão o síndico recebe 42501 mesmo com o filtro certo.
--
-- `payload` vem de `proposta_versoes` (subquery pela versão vigente) — é o snapshot que o PDF do
-- portal renderiza (AC-2: reflete a versão, nunca uma releitura ao vivo das tabelas).
--
-- Rollback:
--   drop view if exists comercial.portal_propostas;

create view comercial.portal_propostas
with (security_barrier = true) as
select
  p.id,
  p.oportunidade_id,
  o.cliente_id,
  p.tipo,
  p.status,
  p.escopo,
  p.preco_centavos,
  p.valido_ate,
  p.versao_atual,
  p.created_at,
  (
    select v.payload from comercial.proposta_versoes v
     where v.proposta_id = p.id and v.versao = p.versao_atual
     limit 1
  ) as payload
from comercial.propostas p
join comercial.oportunidades o on o.id = p.oportunidade_id
where p.status in ('enviada', 'aceita', 'recusada')
  and o.cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
  and auth.jwt() ->> 'user_role' = 'cliente-sindico';

grant select on comercial.portal_propostas to authenticated;

comment on view comercial.portal_propostas is
  'E03-S06 AC-3/AC-4: interface de leitura restrita ao síndico da própria Conta. Filtro embutido '
  'na view (não security_invoker) — a RLS normal de comercial.propostas exige módulo comercial, '
  'que cliente-sindico nunca tem.';
