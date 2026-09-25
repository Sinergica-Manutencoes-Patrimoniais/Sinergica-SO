-- 0209_E01-S151_backlog_sem_chamado.sql — Sinérgica SO
-- Lucas + Fabrício (2026-08-16): item de backlog não deve ter número de Chamado até alguém decidir
-- que ele vira um de verdade — "pode ser que não tenha uma tratativa". Hoje `criarOrdemServico`
-- sempre cria um Chamado automático na hora (migration 0151/ADR-0014), mesmo pra item de backlog
-- puro. Isso NÃO reverte ADR-0014 (Chamado continua o único identificador de ponta a ponta) — só
-- adia a criação do Chamado pra depois da triagem.
--
-- `pcm.ordens_servico.numero` é `not null unique` (migration 0001) e ~43 lugares no frontend leem
-- `.numero` como string simples — tornar nullable exigiria tocar em Kanban/Timeline/Calendário/
-- Dashboard/Backlog. Em vez disso, a trigger de sync (0151) gera um placeholder `PRE-XXXXXXXX`
-- quando `chamado_id` é null: nunca confundível com um `CH-XXXX` real, sem mudar nenhum tipo.
--
-- RECONSTRUÍDA nesta sessão (E01-S146) — ver nota em 0205_E02-S31_ia_gasto_log.sql.
--
-- Reverso:
--   (reaplicar a versão da função em 0151_E01-S99_chamado_id_unico.sql:61-77)

create or replace function pcm.fn_ordens_servico_sync_numero_chamado()
returns trigger
language plpgsql
as $$
declare
  v_numero text;
begin
  if new.chamado_id is not null then
    select numero into v_numero from pcm.chamados where id = new.chamado_id;
    if v_numero is null then
      raise exception 'Chamado % não encontrado para vincular a OS', new.chamado_id;
    end if;
    new.numero := v_numero;
  elsif new.numero is null then
    -- E01-S151: item de backlog pré-triagem — placeholder nunca confundível com CH-XXXX.
    new.numero := 'PRE-' || upper(substr(new.id::text, 1, 8));
  end if;
  return new;
end;
$$;
