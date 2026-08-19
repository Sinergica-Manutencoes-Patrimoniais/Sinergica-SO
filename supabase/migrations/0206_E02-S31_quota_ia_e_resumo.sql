-- 0206_E02-S31_quota_ia_e_resumo.sql — Sinérgica SO
-- E02-S31 AC-2: limite de quota mensal de IA, configurável por superadmin em
-- Configurações > Integrações > IA. AC-1: view agregada por módulo/mês pro dashboard —
-- agregação em SQL em vez de somar client-side (mês pode ter centenas de linhas em
-- `config.ia_gasto_log`).
--
-- RECONSTRUÍDA nesta sessão (E01-S146) — ver nota em 0205_E02-S31_ia_gasto_log.sql.
--
-- Reverso:
--   drop view if exists config.ia_gasto_resumo_mes;
--   alter table config.integracoes drop column if exists limite_quota_ia_usd;

alter table config.integracoes
  add column if not exists limite_quota_ia_usd numeric(12, 2) check (limite_quota_ia_usd is null or limite_quota_ia_usd >= 0);

comment on column config.integracoes.limite_quota_ia_usd is
  'E02-S31 AC-2: limite mensal de gasto de IA em USD. NULL ou 0 = sem limite (não desabilita IA).';

create or replace view config.ia_gasto_resumo_mes
with (security_invoker = true) as
select
  date_trunc('month', created_at) as mes_ref,
  modulo,
  sum(usd_cost) as usd_total,
  count(*) as qtde,
  avg(usd_cost) as usd_medio
from config.ia_gasto_log
group by date_trunc('month', created_at), modulo;

grant select on config.ia_gasto_resumo_mes to authenticated;
