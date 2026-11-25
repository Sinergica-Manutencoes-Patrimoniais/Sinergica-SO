-- 1881_E02-S25_trigger_automatico_ligado.sql — Sinérgica SO
-- Story E02-S25. A migration 0158 criou as colunas `auto_*` e a função pura
-- `_shared/trigger-automatico.ts` já decidia a matriz da spec — mas NADA chamava a decisão e
-- nada sabia dizer "quando foi a última resposta humana". A story estava parada exatamente aí
-- (ver o SPEC_DEVIATION da task 5 em `specs/E02-S25-ze-trigger-resposta-automatica/tasks.md`).
--
-- Esta migration responde à pergunta que bloqueava a integração e traz as duas peças de banco
-- que faltavam:
--
--   1. DE ONDE VEM "ÚLTIMA RESPOSTA HUMANA" — de `atendimento.mensagens`, pela coluna
--      `origem_envio` que a E02-S32 (migration 0207) e a E02-S39 (migration 1850) já
--      estabeleceram: saída com `origem_envio in ('formulario','celular')` é humano de verdade
--      (Inbox ou aparelho). `'ia'` é o próprio Zé e `'celular_automatico'` é mensagem automática
--      do WhatsApp Business — nenhuma das duas conta como atendimento humano, senão o Zé ficaria
--      mudo esperando um humano que nunca falou. `remetente_tipo='humano'` sozinho NÃO servia:
--      cobre formulário e celular igual, e é o próprio comentário de 0207 que diz isso.
--
--   2. JANELA POR DIA DA SEMANA (AC-6) — `auto_janela_inicio/fim` de 0158 é UMA janela aplicada a
--      todos os dias de `auto_dias`; a spec pede horário próprio por dia (seg–sex 08–18, sáb
--      08–12, dom nenhum). `atendimento.persona_janela_automatica` é aditiva: enquanto não houver
--      linha para uma persona, o par legado de 0158 continua valendo exatamente como hoje.
--
-- Mais duas travas de segurança operacional, portadas do TriviAtende (ADR dele, `despacho_ritmo`
-- + `cancelar_intencoes_ao_assumir`):
--
--   3. `wa_queue.reagendamentos` — o AC-2 ("X minutos sem resposta humana") só acontece de
--      verdade se alguém voltar a olhar a conversa quando a espera vence. O item da fila passa a
--      ser REAGENDADO para esse instante (o cron `process_wa_queue_ze_minutely` já existe e
--      drena), e este contador é o teto que impede reagendamento infinito.
--   4. `fn_cancelar_fila_ze_ao_assumir` — humano assumir a conversa cancela o que estava
--      agendado. Sem isso, o Zé responde por cima de um atendimento humano que acabou de começar:
--      o item já estava na fila com `wait_until` no futuro quando o humano entrou.
--
-- Reverso:
--   drop trigger if exists trg_cancelar_fila_ze_ao_assumir on atendimento.conversas;
--   drop function if exists atendimento.fn_cancelar_fila_ze_ao_assumir();
--   drop function if exists atendimento.fn_minutos_sem_resposta_humana(uuid);
--   drop index if exists atendimento.idx_mensagens_resposta_humana;
--   alter table atendimento.wa_queue drop column if exists reagendamentos;
--   drop table if exists atendimento.persona_janela_automatica;

-- ── 1. Janela por dia da semana (AC-6) ────────────────────────────────────────────────────────
create table if not exists atendimento.persona_janela_automatica (
  id          uuid        primary key default gen_random_uuid(),
  persona_id  uuid        not null references atendimento.personas (id) on delete cascade,
  -- 0=domingo .. 6=sábado. Dia SEM linha nenhuma = sem atendimento humano o dia todo, que é
  -- exatamente o "domingo sem janela" do AC-6 — ausência é a forma de dizer isso, não um registro
  -- especial com horário zerado.
  dia_semana  integer    not null check (dia_semana between 0 and 6),
  inicio      time        not null,
  fim         time        not null,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users,
  check (fim > inicio),
  unique (persona_id, dia_semana)
);

comment on table atendimento.persona_janela_automatica is
  'E02-S25 AC-6: horário de atendimento HUMANO por dia da semana. Fora dele o Zé assume sozinho. Sem linha para a persona, vale o par legado auto_dias/auto_janela_inicio/auto_janela_fim (migration 0158).';

create index if not exists idx_persona_janela_automatica_persona
  on atendimento.persona_janela_automatica (persona_id);

alter table atendimento.persona_janela_automatica enable row level security;
alter table atendimento.persona_janela_automatica force row level security;

grant select, insert, update, delete on atendimento.persona_janela_automatica to authenticated;
grant select, insert, update, delete on atendimento.persona_janela_automatica to service_role;

-- ADR-1691 / E00-S27: a condição é `config.sso_acesso_atual`, que relê `config.usuarios` +
-- `resolver_permissoes_modulo` AO VIVO a cada linha. Decidir pelo `auth.jwt()` sozinho é decidir
-- por um carimbo do login: revogar o acesso de alguém não surtiria efeito até o token expirar.
-- A função já cobre superadmin e já exige `u.ativo`, então ela é a condição inteira — somar um
-- `or auth.jwt() ...` reabriria o mesmo buraco pelo outro lado. Ver também a 1882.
create policy "persona_janela_automatica_select" on atendimento.persona_janela_automatica
  for select to authenticated
  using (config.sso_acesso_atual('atendimento', 'leitura'));

create policy "persona_janela_automatica_escrita" on atendimento.persona_janela_automatica
  for all to authenticated
  using (config.sso_acesso_atual('atendimento', 'escrita'))
  with check (config.sso_acesso_atual('atendimento', 'escrita'));

-- ── 2. "Há quantos minutos um humano respondeu?" ──────────────────────────────────────────────
-- Índice parcial: a consulta é sempre a MESMA (última saída humana de uma conversa), então o
-- índice cobre exatamente ela e nada mais.
create index if not exists idx_mensagens_resposta_humana
  on atendimento.mensagens (conversa_id, created_at desc)
  where direcao = 'saida' and origem_envio in ('formulario', 'celular');

create or replace function atendimento.fn_minutos_sem_resposta_humana(p_conversa_id uuid)
returns integer
language sql
stable
security definer
set search_path = atendimento, public
as $$
  select case
           when max(m.created_at) is null then null
           else greatest(floor(extract(epoch from (now() - max(m.created_at))) / 60)::integer, 0)
         end
    from atendimento.mensagens m
   where m.conversa_id = p_conversa_id
     and p_conversa_id is not null
     and m.direcao = 'saida'
     and m.origem_envio in ('formulario', 'celular');
$$;

comment on function atendimento.fn_minutos_sem_resposta_humana(uuid) is
  'E02-S25 AC-2/AC-4: minutos desde a última resposta HUMANA (Inbox ou aparelho) na conversa. NULL = nenhum humano respondeu ainda — o chamador trata como "não assume por inatividade" (conservador).';

revoke all on function atendimento.fn_minutos_sem_resposta_humana(uuid) from public;
grant execute on function atendimento.fn_minutos_sem_resposta_humana(uuid) to service_role;

-- ── 3. Teto de reagendamentos da fila ─────────────────────────────────────────────────────────
alter table atendimento.wa_queue
  add column if not exists reagendamentos integer not null default 0;

comment on column atendimento.wa_queue.reagendamentos is
  'E02-S25 AC-2: quantas vezes este item foi adiado esperando a inatividade humana vencer. Teto no `pcm-ze-agent` — espera adiada para sempre é bot mudo, não bot educado.';

-- ── 4. Humano assumiu: cancela o que o Zé tinha agendado ──────────────────────────────────────
create or replace function atendimento.fn_cancelar_fila_ze_ao_assumir()
returns trigger
language plpgsql
security definer
set search_path = atendimento, public
as $$
begin
  -- Só quando a conversa PASSA a estar com humano: `modo` vira 'pausado' (handoff, E02-S01/
  -- E02-S39) ou alguém é atribuído. Reatribuir de uma pessoa para outra não precisa cancelar de
  -- novo — já estava cancelado.
  if (new.modo = 'pausado' and coalesce(old.modo, '') <> 'pausado')
     or (new.atribuido_a is not null and old.atribuido_a is null) then
    update atendimento.wa_queue
       set status = 'skipped',
           error_message = 'E02-S25: humano assumiu a conversa',
           processed_at = now()
     where queue_key = new.instance_id || ':' || new.remote_jid
       and status = 'pending';
  end if;
  return new;
end;
$$;

revoke all on function atendimento.fn_cancelar_fila_ze_ao_assumir() from public;

drop trigger if exists trg_cancelar_fila_ze_ao_assumir on atendimento.conversas;
create trigger trg_cancelar_fila_ze_ao_assumir
  after update of modo, atribuido_a on atendimento.conversas
  for each row
  execute function atendimento.fn_cancelar_fila_ze_ao_assumir();

-- ── Verificação (rode após aplicar) ───────────────────────────────────────────────────────────
-- select atendimento.fn_minutos_sem_resposta_humana('<conversa_id>');
-- select * from atendimento.persona_janela_automatica order by persona_id, dia_semana;
