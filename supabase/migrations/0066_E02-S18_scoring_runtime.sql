-- 0066_E02-S18_scoring_runtime.sql — cálculo executável e classificação determinística.
-- Reverso: drop functions; remover colunas lead_tier/cluster_nome de comercial.leads.

alter table comercial.leads
  add column if not exists lead_tier text,
  add column if not exists cluster_nome text;

create or replace function atendimento.fn_calcular_lead_score(p_eventos jsonb)
returns int
language sql
stable
security invoker
set search_path = atendimento, public
as $$
  with cfg as (
    select componentes, behavior_cap
    from atendimento.lead_scoring_config
    limit 1
  ), pontos as (
    select coalesce(sum(
      coalesce((cfg.componentes ->> (evento ->> 'evento'))::int, 0)
      * greatest(coalesce((evento ->> 'quantidade')::int, 1), 0)
    ), 0)::int as total, cfg.behavior_cap
    from cfg
    left join lateral jsonb_array_elements(coalesce(p_eventos, '[]'::jsonb)) evento on true
    group by cfg.behavior_cap
  )
  select least(greatest(total, 0), behavior_cap) from pontos;
$$;

create or replace function atendimento.fn_classificar_cluster(
  p_lead_tier text,
  p_segmento text default null,
  p_subsegmento text default null
) returns text
language sql
stable
security invoker
set search_path = atendimento, public
as $$
  select nome
  from atendimento.cluster_regras
  where ativo
    and (lead_tier is null or lead_tier = p_lead_tier)
    and (segmento is null or segmento = p_segmento)
    and (subsegmento is null or subsegmento = p_subsegmento)
  order by prioridade asc,
    ((lead_tier is not null)::int + (segmento is not null)::int + (subsegmento is not null)::int) desc,
    created_at asc
  limit 1;
$$;

revoke all on function atendimento.fn_calcular_lead_score(jsonb) from public;
revoke all on function atendimento.fn_classificar_cluster(text, text, text) from public;
grant execute on function atendimento.fn_calcular_lead_score(jsonb) to authenticated, service_role;
grant execute on function atendimento.fn_classificar_cluster(text, text, text) to authenticated, service_role;
