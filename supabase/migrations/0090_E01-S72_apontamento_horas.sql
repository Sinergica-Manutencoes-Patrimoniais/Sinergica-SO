-- 0090_E01-S72_apontamento_horas.sql — Sinérgica SO
-- Teste de produção do Lucas (2026-07-14): "a parte de apontamento de horas do Auvo precisamos
-- trazer para o PCM, pois a partir dele linkamos com as tarefas, com o cliente, com o funcionário
-- e damos uma visão de gastos com aquele cliente". Não há endpoint público de apontamento de
-- horas no Auvo (`docs/AUDITORIA-AUVO-API.md`) — mas GET /tasks já traz checkInDate/checkOutDate/
-- durationDecimal, já gravados em pcm.ordens_servico (check_in_at/check_out_at) e
-- auvo_detalhes->duracaoHoras. A visão de horas é 100% derivável localmente, sem sync novo.
--
-- Só JOIN/filtro aqui — o cálculo de horas (prioridade duracaoHoras, fallback diff de datas, sem
-- dado → 0) é puro no client (`domain/apontamento-horas.ts`), testável, não duplicado em SQL.
--
-- Reverso:
--   drop function if exists pcm.fn_apontamento_horas(date, date);

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
    (os.auvo_detalhes ->> 'duracaoHoras')::numeric
  from pcm.ordens_servico os
  left join pcm.clientes c on c.id = os.client_id
  left join pcm.funcionarios f on f.id = os.tecnico_funcionario_id
  where coalesce(os.data_agendada, os.created_at) >= p_inicio
    and coalesce(os.data_agendada, os.created_at) < (p_fim + 1);
$$;

-- SECURITY INVOKER (padrão, sem `security definer`) — roda com o papel de quem chama, então o
-- SELECT em ordens_servico/clientes/funcionarios continua sob as MESMAS RLS policies já
-- existentes (pcm leitura/escrita), sem duplicar checagem de permissão aqui dentro.
grant execute on function pcm.fn_apontamento_horas(date, date) to authenticated;
