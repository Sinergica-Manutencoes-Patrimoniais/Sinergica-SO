-- 0052_E02-S10_atendimento_metrics.sql — Sinérgica SO
-- Story E02-S10. RPC de agregação server-side do painel de Atendimento — foge do cap de 1000
-- linhas do PostgREST (o dashboard atual computa KPIs no cliente sobre a lista de conversas
-- inteira). Ver specs/E02-S10-metricas-server-side-atendimento/{spec.md,design.md}.
--
-- Métricas de "fila agora" (filaSemAtendente, abertas, naoLidas, maisAntigaNaFila, aging) são
-- SEMPRE estado atual, independente do período selecionado — refletem a fila neste instante.
-- Métricas de "atividade no período" (frtMedio, mixCanal, mixModo, autonomia, escalonado,
-- encerradas) usam a janela `p_periodo` ('hoje'|'7d'|'30d'). `abertasHoje`/`abertasOntem` são
-- sempre hoje-vs-ontem, independente do seletor (mesmo comportamento do card do heziomos).
--
-- A migration cria a fonte canônica de CSAT (`atendimento.csat_respostas`) e agrega média +
-- quantidade no snapshot. Isso evita manter o card como dado fictício no cliente.
--
-- `throughput`/`cargaAtendente` (E02-S12) fazem LEFT JOIN em `config.usuarios` para o nome de
-- exibição — mas essa tabela tem RLS restrita a `user_id = auth.uid() OR user_role = 'admin'`
-- (0002). Como a RPC roda `security invoker` (ver abaixo), um usuário não-admin vendo o painel
-- só enxerga o PRÓPRIO nome nessas listas; os demais aparecem como "Sem nome" (RLS filtra a linha
-- do join, não erro). Aceitável: quem acessa o módulo Atendimento com permissão de leitura/escrita
-- tende a já ser admin/supervisor; documentado aqui em vez de resolvido com um helper
-- security-definer (mais uma superfície de bypass de RLS para justificar depois).
--
-- "Escalonado"/"deflexão" são PROXIES pelo estado atual (sem tabela de histórico de transição de
-- `modo`): escalonado = conversas abertas no período com modo='pausado' agora; deflexão =
-- conversas encerradas no período que nunca tiveram atribuido_a preenchido. Não é o mesmo que um
-- evento histórico de "quando escalou", mas é o melhor sinal disponível no schema atual — ver
-- Questões em aberto do design.md.
--
-- Reverso:
--   drop function if exists atendimento.fn_metrics_snapshot(text);

create table if not exists atendimento.csat_respostas (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references atendimento.conversas(id),
  nota int not null check (nota between 1 and 5),
  comentario text,
  created_at timestamptz not null default now()
);
alter table atendimento.csat_respostas enable row level security;
alter table atendimento.csat_respostas force row level security;
grant select on atendimento.csat_respostas to authenticated;
grant select, insert, update, delete on atendimento.csat_respostas to service_role;
create policy "csat_respostas_select" on atendimento.csat_respostas for select to authenticated
using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
);

-- SEM `security definer` DE PROPÓSITO: a função roda com o privilégio de quem chama
-- (`security invoker`, o padrão), então as policies já existentes de
-- `atendimento.conversas`/`mensagens` (0039/0040 — leitura exige módulo `atendimento` em
-- leitura/escrita, ou superadmin) se aplicam automaticamente à agregação. Isso evita duplicar a
-- checagem de permissão aqui dentro (uma reimplementação manual via `auth.jwt()` seria bypassada
-- silenciosamente se esta função algum dia for chamada por um client `service_role`, já que
-- `auth.jwt()` não erra fora do contexto de request do PostgREST — PL/pgSQL trata condição NULL
-- como falsa no IF, não como erro). A Edge Function `atendimento-metrics` chama esta RPC
-- repassando o JWT do usuário final (não a service_role key), preservando esse contrato.
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
        where created_at >= v_desde
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

-- Índices dedicados à agregação (eixo Infra do design.md) — evita full scan em `aging`/`frt`/mix
-- à medida que o volume de conversas/mensagens cresce.
create index if not exists idx_atendimento_conversas_status_naolidas_ultima
  on atendimento.conversas (status, nao_lidas, ultima_mensagem_em)
  where status = 'aberta';
create index if not exists idx_atendimento_conversas_created_canal
  on atendimento.conversas (created_at, canal);
create index if not exists idx_atendimento_mensagens_direcao_created
  on atendimento.mensagens (direcao, created_at);

revoke all on function atendimento.fn_metrics_snapshot(text) from public;
grant execute on function atendimento.fn_metrics_snapshot(text) to authenticated, service_role;

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select atendimento.fn_metrics_snapshot('hoje');
-- select atendimento.fn_metrics_snapshot('7d');
-- select proname, prosecdef from pg_proc where proname = 'fn_metrics_snapshot';
