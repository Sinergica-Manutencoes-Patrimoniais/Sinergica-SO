-- 0094_E01-S72_fix_duracao_horas_vazia.sql — Sinérgica SO
-- Achado em teste Playwright contra produção (2026-07-14): abrir Apontamento de Horas quebrava a
-- página inteira com "invalid input syntax for type numeric: \"\"" (22P02). Causa: pelo menos uma
-- OS real tem `auvo_detalhes->>'duracaoHoras'` gravado como string vazia (não null, não ausente) —
-- o cast direto `::numeric` do migration 0090 não tolera string vazia, só null/ausente.
--
-- Reverso: reverter pra versão anterior da função (ver 0090) — não recomendado, reintroduz o bug.

create or replace function pcm.fn_apontamento_horas(p_inicio date, p_fim date)
returns table (
  os_id uuid,
  os_numero text,
  cliente_id uuid,
  cliente_nome text,
  tecnico_funcionario_id uuid,
  tecnico_nome text,
  data_agendada timestamptz,
  check_in_at timestamptz,
  check_out_at timestamptz,
  duracao_horas numeric
)
language sql
stable
set search_path = pcm, public
as $$
  select
    os.id,
    os.numero,
    os.client_id,
    c.nome,
    os.tecnico_funcionario_id,
    f.nome,
    os.data_agendada,
    os.check_in_at,
    os.check_out_at,
    nullif(os.auvo_detalhes ->> 'duracaoHoras', '')::numeric
  from pcm.ordens_servico os
  left join pcm.clientes c on c.id = os.client_id
  left join pcm.funcionarios f on f.id = os.tecnico_funcionario_id
  where coalesce(os.data_agendada, os.created_at) >= p_inicio
    and coalesce(os.data_agendada, os.created_at) < (p_fim + 1);
$$;

grant execute on function pcm.fn_apontamento_horas(date, date) to authenticated;
