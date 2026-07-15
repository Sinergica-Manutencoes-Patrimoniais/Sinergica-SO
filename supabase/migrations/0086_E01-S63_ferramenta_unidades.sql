-- 0086_E01-S63_ferramenta_unidades.sql — Sinérgica SO
-- Feedback Fabrício (2026-07-13): "queria ver um histórico de quem ficou com cada ferramenta e
-- atribuição ser por código". Hoje `pcm.ferramenta_alocacoes` é um snapshot AGREGADO por
-- (ferramenta, técnico Auvo), sobrescrito a cada pull do Auvo — impossível responder "quem está
-- com a furadeira #3?" ou "quem ficou com ela mês passado?". Decisão do PO: PCM gera e controla o
-- código de unidade (não existe patrimônio físico prévio); PCM é dono da posse/histórico (Auvo
-- vira sinal de conferência via `ferramenta_alocacoes`, que PERMANECE como está — não é mais
-- fonte de verdade de posse, só o agregado que o Auvo enxerga, usado pro badge de divergência).
--
-- Reverso:
--   drop trigger if exists trg_ferramenta_movimentacoes_aplicar on pcm.ferramenta_movimentacoes;
--   drop function if exists pcm.fn_aplicar_movimentacao_ferramenta();
--   drop table if exists pcm.ferramenta_movimentacoes;
--   drop table if exists pcm.ferramenta_unidades;
--   drop sequence if exists pcm.ferramenta_unidade_codigo_seq;

create sequence if not exists pcm.ferramenta_unidade_codigo_seq;

create table if not exists pcm.ferramenta_unidades (
  id            uuid        primary key default gen_random_uuid(),
  ferramenta_id uuid        not null references pcm.ferramentas on delete cascade,
  -- Código gerado pelo PCM via sequência global (nunca reaproveitada, mesmo com baixa) — AC-1.
  codigo        text        not null unique default (
                  'FER-' || lpad(nextval('pcm.ferramenta_unidade_codigo_seq')::text, 4, '0')
                ),
  status        text        not null default 'disponivel'
                  check (status in ('disponivel', 'atribuida', 'baixada')),
  atribuida_a   uuid        references pcm.funcionarios,
  atribuida_em  timestamptz,
  motivo_baixa  text,
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users,
  updated_at    timestamptz not null default now(),
  updated_by    uuid        references auth.users
);

create index if not exists idx_ferramenta_unidades_ferramenta
  on pcm.ferramenta_unidades (ferramenta_id);
create index if not exists idx_ferramenta_unidades_atribuida_a
  on pcm.ferramenta_unidades (atribuida_a)
  where atribuida_a is not null;
create index if not exists idx_ferramenta_unidades_status
  on pcm.ferramenta_unidades (status);

-- Append-only por design (AC-4: histórico "nunca apagada") — sem policy de UPDATE/DELETE pra
-- authenticated, mesmo padrão de `pcm.os_equipamentos_auvo` (migration 0017). O estado atual da
-- unidade (`ferramenta_unidades.status`/`atribuida_a`) é derivado por trigger a partir daqui, não
-- editado direto.
create table if not exists pcm.ferramenta_movimentacoes (
  id             uuid        primary key default gen_random_uuid(),
  unidade_id     uuid        not null references pcm.ferramenta_unidades on delete cascade,
  tipo           text        not null check (tipo in ('atribuicao', 'devolucao', 'baixa')),
  funcionario_id uuid        references pcm.funcionarios,
  condicao       text        check (condicao in ('ok', 'danificada', 'perdida')),
  motivo         text,
  data_movimento timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  created_by     uuid        references auth.users
);

create index if not exists idx_ferramenta_movimentacoes_unidade
  on pcm.ferramenta_movimentacoes (unidade_id, data_movimento desc);
create index if not exists idx_ferramenta_movimentacoes_funcionario
  on pcm.ferramenta_movimentacoes (funcionario_id, data_movimento desc);

alter table pcm.ferramenta_unidades enable row level security;
alter table pcm.ferramenta_unidades force row level security;
alter table pcm.ferramenta_movimentacoes enable row level security;
alter table pcm.ferramenta_movimentacoes force row level security;

grant select, insert, update on pcm.ferramenta_unidades to authenticated;
grant select, insert, update, delete on pcm.ferramenta_unidades to service_role;
grant select, insert on pcm.ferramenta_movimentacoes to authenticated;
grant select, insert, update, delete on pcm.ferramenta_movimentacoes to service_role;

create policy "ferramenta_unidades_select" on pcm.ferramenta_unidades
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "ferramenta_unidades_insert" on pcm.ferramenta_unidades
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- UPDATE só pra `motivo_baixa`/status via trigger (security definer) — a policy ainda existe pra
-- permitir a própria função disparar o UPDATE sob o papel do chamador quando não usar definer, mas
-- a fonte de verdade da transição é sempre uma movimentação inserida (nunca UPDATE direto de fora).
create policy "ferramenta_unidades_update" on pcm.ferramenta_unidades
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "ferramenta_movimentacoes_select" on pcm.ferramenta_movimentacoes
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "ferramenta_movimentacoes_insert" on pcm.ferramenta_movimentacoes
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- Append-only real: nenhuma policy de UPDATE/DELETE pra authenticated → nega por padrão (RLS
-- FORCE sem policy = bloqueado). Explícito aqui pra documentar a intenção (mesmo padrão de
-- `os_equipamentos_auvo_deny_update`/`_deny_delete`, migration 0017).
create policy "ferramenta_movimentacoes_deny_update" on pcm.ferramenta_movimentacoes
  for update to authenticated using (false);
create policy "ferramenta_movimentacoes_deny_delete" on pcm.ferramenta_movimentacoes
  for delete to authenticated using (false);

-- Deriva o estado atual da unidade a partir da movimentação inserida — a UI nunca faz UPDATE
-- direto em `ferramenta_unidades.status`, só INSERT em `ferramenta_movimentacoes` (AC-2, AC-3,
-- AC-6). Valida a transição (1 atribuição ativa por vez, não devolve/baixa unidade já baixada) —
-- defesa em profundidade além da validação de domínio no app.
create or replace function pcm.fn_aplicar_movimentacao_ferramenta()
returns trigger
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_status_atual text;
begin
  select status into v_status_atual from pcm.ferramenta_unidades where id = new.unidade_id for update;

  if new.tipo = 'atribuicao' then
    if v_status_atual <> 'disponivel' then
      raise exception 'Unidade % não está disponível para atribuição (status atual: %)', new.unidade_id, v_status_atual;
    end if;
    if new.funcionario_id is null then
      raise exception 'Atribuição exige funcionario_id';
    end if;
    update pcm.ferramenta_unidades
    set status = 'atribuida', atribuida_a = new.funcionario_id, atribuida_em = new.data_movimento,
        updated_at = now(), updated_by = new.created_by
    where id = new.unidade_id;
  elsif new.tipo = 'devolucao' then
    if v_status_atual <> 'atribuida' then
      raise exception 'Unidade % não está atribuída (status atual: %)', new.unidade_id, v_status_atual;
    end if;
    update pcm.ferramenta_unidades
    set status = case when new.condicao in ('danificada', 'perdida') then 'baixada' else 'disponivel' end,
        motivo_baixa = case when new.condicao in ('danificada', 'perdida') then new.motivo else motivo_baixa end,
        atribuida_a = null, atribuida_em = null,
        updated_at = now(), updated_by = new.created_by
    where id = new.unidade_id;
  elsif new.tipo = 'baixa' then
    if v_status_atual = 'baixada' then
      raise exception 'Unidade % já está baixada', new.unidade_id;
    end if;
    if new.motivo is null or btrim(new.motivo) = '' then
      raise exception 'Baixa exige motivo';
    end if;
    update pcm.ferramenta_unidades
    set status = 'baixada', motivo_baixa = new.motivo, atribuida_a = null, atribuida_em = null,
        updated_at = now(), updated_by = new.created_by
    where id = new.unidade_id;
  end if;

  return new;
end;
$$;

create trigger trg_ferramenta_movimentacoes_aplicar
after insert on pcm.ferramenta_movimentacoes
for each row execute function pcm.fn_aplicar_movimentacao_ferramenta();
