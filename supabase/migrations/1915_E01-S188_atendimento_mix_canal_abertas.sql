-- 1915_E01-S188_atendimento_mix_canal_abertas.sql — Sinérgica SO
-- Defeito D do caderno de validação: o bloco "Mix de canal" dizia "Sem conversas" enquanto os KPIs
-- mostravam conversas abertas. Causa: `abertas` conta `status='aberta'` AGORA, mas `mixCanal`
-- contava conversas CRIADAS na janela do período (qualquer status) — conversa aberta criada antes
-- da janela ("hoje") sumia do Mix. Agora `mixCanal` usa a mesma base de `abertas`: conversas
-- abertas agora, por canal (soma do Mix == KPI Abertas, independente do seletor de período).
-- Demais métricas inalteradas (cópia fiel de 0052 exceto o bloco mixCanal).
--
-- Reverso: reaplicar a definição de atendimento.fn_metrics_snapshot de 0052_E02-S10.

create or replace function atendimento.fn_metrics_snapshot(p_periodo text default 'hoje')
returns jsonb
language plpgsql
stable
set search_path = atendimento, public
as $$
declare
  v_desde timestamptz;
  v_hoje_inicio timestamptz := date_trunc('day', now());
  v_ontem_inicio timestamptz := date_trunc('day', now()) - interval '1 day';
  v_resultado jsonb;
begin
  if p_periodo not in ('hoje', '7d', '30d') then
    raise exception 'periodo inválido: % (use hoje, 7d ou 30d)', p_periodo;
  end if;

  v_desde := case p_periodo
    when 'hoje' then v_hoje_inicio
    when '7d' then now() - interval '7 days'
    when '30d' then now() - interval '30 days'
  end;

  select jsonb_build_object(
    'periodo', p_periodo,
    'filaSemAtendente', (
      select count(*) from atendimento.conversas where status = 'aberta' and atribuido_a is null
    ),
    'abertas', (
      select count(*) from atendimento.conversas where status = 'aberta'
    ),
    'naoLidas', (
      select count(*) from atendimento.conversas where status = 'aberta' and nao_lidas > 0
    ),
    'maisAntigaNaFilaSegundos', (
      select extract(epoch from (now() - min(ultima_mensagem_em)))
      from atendimento.conversas
      where status = 'aberta' and nao_lidas > 0 and ultima_mensagem_em is not null
    ),
    'abertasHoje', (
      select count(*) from atendimento.conversas where created_at >= v_hoje_inicio
    ),
    'abertasOntem', (
      select count(*) from atendimento.conversas
      where created_at >= v_ontem_inicio and created_at < v_hoje_inicio
    ),
    'aging', (
      select coalesce(jsonb_agg(jsonb_build_object('faixa', faixa, 'total', total)), '[]'::jsonb)
      from (
        select
          case
            when now() - ultima_mensagem_em < interval '1 hour' then '0-1h'
            when now() - ultima_mensagem_em < interval '4 hours' then '1-4h'
            when now() - ultima_mensagem_em < interval '24 hours' then '4-24h'
            else '+24h'
          end as faixa,
          count(*) as total
        from atendimento.conversas
        where status = 'aberta' and nao_lidas > 0 and ultima_mensagem_em is not null
        group by 1
      ) t
    ),
    'frtMedioSegundos', (
      select avg(extract(epoch from (resp.created_at - ent.created_at)))
      from atendimento.mensagens ent
      join lateral (
        select m2.created_at
        from atendimento.mensagens m2
        where m2.conversa_id = ent.conversa_id
          and m2.direcao = 'saida'
          and m2.created_at > ent.created_at
        order by m2.created_at asc
        limit 1
      ) resp on true
      where ent.direcao = 'entrada' and ent.created_at >= v_desde
    ),
    'mixCanal', (
      select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'total', total)), '[]'::jsonb)
      from (
        select canal, count(*) as total
        from atendimento.conversas
        where status = 'aberta'
        group by canal
      ) t
    ),
    'mixModo', (
      select coalesce(jsonb_agg(jsonb_build_object('modo', modo, 'total', total)), '[]'::jsonb)
      from (
        select modo, count(*) as total
        from atendimento.conversas
        where status = 'aberta' and created_at >= v_desde
        group by modo
      ) t
    ),
    'autonomiaZe', (
      select count(*) from atendimento.mensagens
      where direcao = 'saida' and remetente_tipo in ('ze', 'agente') and created_at >= v_desde
    ),
    'autonomiaHumano', (
      select count(*) from atendimento.mensagens
      where direcao = 'saida' and remetente_tipo = 'humano' and created_at >= v_desde
    ),
    'escalonadoTotal', (
      select count(*) from atendimento.conversas
      where modo = 'pausado' and created_at >= v_desde
    ),
    'encerradasTotal', (
      select count(*) from atendimento.conversas
      where status = 'encerrada' and updated_at >= v_desde
    ),
    'encerradasSemHumano', (
      select count(*) from atendimento.conversas
      where status = 'encerrada' and updated_at >= v_desde and atribuido_a is null
    ),
    'csatMedia', (
      select avg(nota)::numeric from atendimento.csat_respostas where created_at >= v_desde
    ),
    'csatRespostas', (
      select count(*) from atendimento.csat_respostas where created_at >= v_desde
    ),
    -- Séries por período (E02-S12 — widgets analíticos avançados). Dia em UTC (mesma convenção
    -- do resto do módulo, sem bucket por fuso — ver `v_hoje_inicio` acima).
    'volumeDiario', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'entrada', entrada, 'saida', saida) order by dia), '[]'::jsonb)
      from (
        select
          date_trunc('day', created_at) as dia,
          count(*) filter (where direcao = 'entrada') as entrada,
          count(*) filter (where direcao = 'saida') as saida
        from atendimento.mensagens
        where created_at >= v_desde
        group by 1
      ) t
    ),
    'slaDentroMetaPct', (
      select round(
        100.0 * count(*) filter (where extract(epoch from (resp.created_at - ent.created_at)) <= 300)
        / nullif(count(*), 0)
      )
      from atendimento.mensagens ent
      join lateral (
        select m2.created_at
        from atendimento.mensagens m2
        where m2.conversa_id = ent.conversa_id
          and m2.direcao = 'saida'
          and m2.created_at > ent.created_at
        order by m2.created_at asc
        limit 1
      ) resp on true
      where ent.direcao = 'entrada' and ent.created_at >= v_desde
    ),
    'heatmapHora', (
      select coalesce(jsonb_agg(jsonb_build_object('diaSemana', dow, 'hora', hora, 'total', total)), '[]'::jsonb)
      from (
        select
          extract(dow from created_at)::int as dow,
          extract(hour from created_at)::int as hora,
          count(*) as total
        from atendimento.mensagens
        where direcao = 'entrada' and created_at >= v_desde
        group by 1, 2
      ) t
    ),
    'throughput', (
      select coalesce(jsonb_agg(jsonb_build_object('userId', user_id, 'nome', nome, 'enviadas', enviadas) order by enviadas desc), '[]'::jsonb)
      from (
        select
          m.remetente_id as user_id,
          coalesce(u.nome, 'Sem nome') as nome,
          count(*) as enviadas
        from atendimento.mensagens m
        left join config.usuarios u on u.user_id = m.remetente_id
        where m.direcao = 'saida' and m.remetente_tipo = 'humano' and m.created_at >= v_desde
          and m.remetente_id is not null
        group by 1, 2
      ) t
    ),
    'cargaAtendente', (
      select coalesce(jsonb_agg(jsonb_build_object('userId', user_id, 'nome', nome, 'abertas', abertas) order by abertas desc), '[]'::jsonb)
      from (
        select
          c.atribuido_a as user_id,
          coalesce(u.nome, 'Sem nome') as nome,
          count(*) as abertas
        from atendimento.conversas c
        left join config.usuarios u on u.user_id = c.atribuido_a
        where c.status = 'aberta' and c.atribuido_a is not null
        group by 1, 2
      ) t
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;
