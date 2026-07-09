-- 0072_E01-S38_rpc_enriquecer_os_em_lote.sql — Sinérgica SO
-- Backfill retroativo do E01-S38 (técnico/data/check-in-out/detalhes) precisa ATUALIZAR as OS que
-- JÁ existem localmente (`pcm-auvo-tasks-import` só INSERE tarefa nova — a que já tem OS local
-- cai em "ignorada" e nunca é revisitada). Atualizar 1 linha por vez via `.update()` reintroduziria
-- o mesmo problema de N round-trips já corrigido no insert em lote (E01-S34) — em vez disso, uma
-- única RPC recebe um array jsonb e faz 1 UPDATE ... FROM jsonb_array_elements(...) pra todo o
-- lote, independente de quantas linhas.
--
-- Nunca toca `status`/`titulo`/outras colunas — só os campos de E01-S38 — então não aciona
-- `trg_auvo_create_task_on_planejamento` (só dispara em transição de status).
--
-- Reverso:
--   drop function if exists pcm.fn_enriquecer_os_em_lote(jsonb);

create or replace function pcm.fn_enriquecer_os_em_lote(p_atualizacoes jsonb)
returns int
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_count int := 0;
begin
  if p_atualizacoes is null or jsonb_typeof(p_atualizacoes) <> 'array' then
    raise exception 'p_atualizacoes precisa ser um array jsonb';
  end if;

  update pcm.ordens_servico os set
    tecnico_auvo_user_id = nullif(u.dados->>'tecnico_auvo_user_id', '')::bigint,
    tecnico_funcionario_id = nullif(u.dados->>'tecnico_funcionario_id', '')::uuid,
    data_agendada = nullif(u.dados->>'data_agendada', '')::timestamptz,
    check_in_at = nullif(u.dados->>'check_in_at', '')::timestamptz,
    check_out_at = nullif(u.dados->>'check_out_at', '')::timestamptz,
    auvo_detalhes = u.dados->'auvo_detalhes'
  from jsonb_array_elements(p_atualizacoes) as u(dados)
  where os.auvo_task_id = (u.dados->>'auvo_task_id')::bigint;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function pcm.fn_enriquecer_os_em_lote(jsonb) from public;
grant execute on function pcm.fn_enriquecer_os_em_lote(jsonb) to service_role;

comment on function pcm.fn_enriquecer_os_em_lote(jsonb)
  is 'E01-S38: atualiza técnico/data agendada/check-in-out/detalhes em lote pra OS que já existem localmente (tasks-import só insere tarefa nova) — 1 UPDATE pro lote inteiro, não 1 por linha.';
