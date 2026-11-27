-- 1911_E01-S205_arquivar_dados_teste_e2e.sql — Sinérgica SO
-- Instrumento para ARQUIVAR (não apagar) os registros "[TESTE E2E] ..." que specs Playwright
-- gravaram em produção e hoje encabeçam os seletores.
--
-- O QUE ESTA MIGRATION FAZ AO SER APLICADA: SÓ DDL. NENHUM dado de negócio é alterado.
--   Cria: pcm.e2e_allowlist, pcm.e2e_arquivamento, pcm.e2e_selecionar_arquivaveis(),
--         pcm.arquivar_dados_teste_e2e(boolean), pcm.restaurar_dados_teste_e2e(uuid).
--   Semeia a allowlist por NOME EXATO (resolvido para id) com a massa ativa do caderno:
--     "[TESTE E2E] Cliente 360 Cockpit A" e "[TESTE E2E] Cliente S90 1791310960607".
-- A execução do arquivamento é um passo À PARTE, só após o dono aprovar o inventário
-- (specs/E01-S205-arquivar-dados-teste-e2e/inventario.sql):
--   select * from pcm.arquivar_dados_teste_e2e();        -- dry-run (padrão): lista, não escreve
--   select * from pcm.arquivar_dados_teste_e2e(true);    -- executa (service_role / SQL editor)
--
-- CRITÉRIO (Fase 1: clientes, áreas, locais, sistemas, equipamentos, ferramentas)
--   Cliente  = nome começa com '[TESTE E2E] ', auvo_id IS NULL, fora da allowlist.
--   Área/Sistema = do cliente acima. Local = de uma Área acima.
--   Equipamento = auvo_id IS NULL, fora da allowlist e (do cliente acima, ou de um Local acima,
--     ou nome com o prefixo e cliente fora da allowlist).
--   Ferramenta = nome com o prefixo, auvo_id IS NULL, fora da allowlist.
--   Só linhas vivas (deleted_at IS NULL). Filhos de cliente da allowlist nunca entram.
--   NÃO toca: chamados, OS, inspeções, comercial, financeiro, Atendimento (decisão do dono).
--
-- OPERAÇÃO: o mecanismo que já existe (deleted_at = now(), ativo = false), sem renomear. Os
--   seletores já filtram deleted_at IS NULL. NÃO toca auvo_sync_status e liga o GUC
--   app.auvo_sync_write na transação: sem isso fn_auvo_enqueue() enfileiraria um 'delete' por
--   linha para o Auvo REAL.
--
-- IDEMPOTENTE: só age em deleted_at IS NULL e o log tem unique parcial (tabela, row_id) das linhas
--   ainda arquivadas; a 2ª execução toca 0 linhas.
-- REVERSÍVEL: pcm.restaurar_dados_teste_e2e([lote]) devolve deleted_at/ativo do log, só nas linhas
--   cujo deleted_at ainda é o carimbo do arquivamento (não ressuscita o que alguém apagou depois).
--
-- Reverso do DDL (após restaurar):
--   drop function if exists pcm.restaurar_dados_teste_e2e(uuid);
--   drop function if exists pcm.arquivar_dados_teste_e2e(boolean);
--   drop function if exists pcm.e2e_selecionar_arquivaveis();
--   drop table if exists pcm.e2e_arquivamento;
--   drop table if exists pcm.e2e_allowlist;

-- ─────────────────────────── allowlist (massa ativa do caderno) ────────────────────────────────
create table if not exists pcm.e2e_allowlist (
  tabela     text        not null check (tabela in
    ('clientes','areas','locais','sistemas','equipamentos','ferramentas')),
  row_id     uuid        not null,
  motivo     text        not null,
  created_at timestamptz not null default now(),
  primary key (tabela, row_id)
);

-- ─────────────────────────── log de arquivamento (base da reversão) ────────────────────────────
create table if not exists pcm.e2e_arquivamento (
  id                  uuid        primary key default gen_random_uuid(),
  lote                uuid        not null,
  tabela              text        not null,
  row_id              uuid        not null,
  nome                text,
  deleted_at_anterior timestamptz,
  ativo_anterior      boolean,
  arquivado_em        timestamptz not null,
  restaurado_em       timestamptz
);
create unique index if not exists uq_e2e_arquivamento_vigente
  on pcm.e2e_arquivamento (tabela, row_id) where restaurado_em is null;

alter table pcm.e2e_allowlist enable row level security;
alter table pcm.e2e_allowlist force row level security;
alter table pcm.e2e_arquivamento enable row level security;
alter table pcm.e2e_arquivamento force row level security;

revoke all on pcm.e2e_allowlist from public, anon, authenticated;
revoke all on pcm.e2e_arquivamento from public, anon, authenticated;
grant select on pcm.e2e_allowlist to authenticated;
grant select on pcm.e2e_arquivamento to authenticated;
grant select, insert, update, delete on pcm.e2e_allowlist to service_role;
grant select, insert, update, delete on pcm.e2e_arquivamento to service_role;

-- Leitura só superadmin; nenhuma policy de escrita para authenticated (RLS nega).
create policy "e2e_allowlist_select" on pcm.e2e_allowlist
  for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin');
create policy "e2e_arquivamento_select" on pcm.e2e_arquivamento
  for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin');
create policy "e2e_allowlist_service" on pcm.e2e_allowlist
  for all to service_role using (true) with check (true);
create policy "e2e_arquivamento_service" on pcm.e2e_arquivamento
  for all to service_role using (true) with check (true);

-- Semente: massa ativa do caderno (CT-27 / form de Nova OS do Backlog / painel em "Todos").
insert into pcm.e2e_allowlist (tabela, row_id, motivo)
select 'clientes', c.id, 'massa ativa do caderno 2026-11 (E01-S205)'
from pcm.clientes c
where c.nome in ('[TESTE E2E] Cliente 360 Cockpit A', '[TESTE E2E] Cliente S90 1791310960607')
on conflict (tabela, row_id) do nothing;

-- ─────────────────────────── seleção (somente leitura) ─────────────────────────────────────────
create or replace function pcm.e2e_selecionar_arquivaveis()
returns table (tabela text, id uuid, nome text, motivo text)
language sql
stable
security definer
set search_path = pcm, public
as $$
  with cli as (               -- clientes de teste fora da allowlist (qualquer estado: pega órfãos)
    select c.id
    from pcm.clientes c
    where starts_with(c.nome, '[TESTE E2E] ')
      and c.auvo_id is null
      and not exists (select 1 from pcm.e2e_allowlist a where a.tabela = 'clientes' and a.row_id = c.id)
  ),
  are as (
    select a.id from pcm.areas a where a.cliente_id in (select id from cli)
  ),
  loc as (
    select l.id from pcm.locais l where l.area_id in (select id from are)
  )
  select 'clientes'::text, c.id, c.nome, 'prefixo [TESTE E2E]'::text
  from pcm.clientes c
  where c.id in (select id from cli) and c.deleted_at is null
  union all
  select 'areas', a.id, a.nome, 'area de cliente [TESTE E2E]'
  from pcm.areas a
  where a.deleted_at is null and a.cliente_id in (select id from cli)
    and not exists (select 1 from pcm.e2e_allowlist w where w.tabela = 'areas' and w.row_id = a.id)
  union all
  select 'locais', l.id, l.nome, 'local de area de cliente [TESTE E2E]'
  from pcm.locais l
  where l.deleted_at is null and l.id in (select id from loc)
    and not exists (select 1 from pcm.e2e_allowlist w where w.tabela = 'locais' and w.row_id = l.id)
  union all
  select 'sistemas', s.id, s.nome, 'sistema de cliente [TESTE E2E]'
  from pcm.sistemas s
  where s.deleted_at is null and s.cliente_id in (select id from cli)
    and not exists (select 1 from pcm.e2e_allowlist w where w.tabela = 'sistemas' and w.row_id = s.id)
  union all
  select 'equipamentos', e.id, e.nome, 'equipamento de cliente/local [TESTE E2E] ou prefixo'
  from pcm.equipamentos e
  where e.deleted_at is null and e.auvo_id is null
    and not exists (select 1 from pcm.e2e_allowlist w where w.tabela = 'equipamentos' and w.row_id = e.id)
    and (
      e.client_id in (select id from cli)
      or e.local_id in (select id from loc)
      or (
        starts_with(e.nome, '[TESTE E2E] ')
        and not exists (
          select 1 from pcm.e2e_allowlist w where w.tabela = 'clientes' and w.row_id = e.client_id
        )
      )
    )
  union all
  select 'ferramentas', f.id, f.nome, 'prefixo [TESTE E2E]'
  from pcm.ferramentas f
  where f.deleted_at is null and f.auvo_id is null
    and starts_with(f.nome, '[TESTE E2E] ')
    and not exists (select 1 from pcm.e2e_allowlist w where w.tabela = 'ferramentas' and w.row_id = f.id);
$$;

-- ─────────────────────────── arquivar (dry-run por padrão) ─────────────────────────────────────
create or replace function pcm.arquivar_dados_teste_e2e(p_executar boolean default false)
returns table (tabela text, id uuid, nome text, lote uuid)
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_lote  uuid := gen_random_uuid();
  v_carimbo timestamptz := clock_timestamp();
  v_tab   text;
begin
  if not p_executar then
    return query select s.tabela, s.id, s.nome, null::uuid from pcm.e2e_selecionar_arquivaveis() s;
    return;
  end if;

  -- Congela a seleção: o UPDATE de uma tabela muda o que as seguintes enxergam (ex.: cliente).
  drop table if exists _e2e_sel;
  create temporary table _e2e_sel on commit drop as
    select * from pcm.e2e_selecionar_arquivaveis();

  -- Anti-loop do Auvo: sem isto, fn_auvo_enqueue() enfileiraria 'delete' para o Auvo real.
  perform set_config('app.auvo_sync_write', 'true', true);

  foreach v_tab in array array['clientes','areas','locais','sistemas','equipamentos','ferramentas']
  loop
    execute format($f$
      insert into pcm.e2e_arquivamento
        (lote, tabela, row_id, nome, deleted_at_anterior, ativo_anterior, arquivado_em)
      select %L, %L, t.id, t.nome, t.deleted_at, t.ativo, %L
      from pcm.%I t
      where t.id in (select s.id from _e2e_sel s where s.tabela = %L) and t.deleted_at is null
      on conflict do nothing
    $f$, v_lote, v_tab, v_carimbo, v_tab, v_tab);

    execute format($f$
      update pcm.%I t set deleted_at = %L, ativo = false
      where t.id in (select s.id from _e2e_sel s where s.tabela = %L) and t.deleted_at is null
    $f$, v_tab, v_carimbo, v_tab);
  end loop;

  perform set_config('app.auvo_sync_write', 'false', true);

  return query select s.tabela, s.id, s.nome, v_lote from _e2e_sel s order by s.tabela, s.nome;
end;
$$;

-- ─────────────────────────── restaurar (reversão) ──────────────────────────────────────────────
create or replace function pcm.restaurar_dados_teste_e2e(p_lote uuid default null)
returns table (tabela text, restauradas integer)
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_tab text;
  v_n   integer;
begin
  perform set_config('app.auvo_sync_write', 'true', true);

  foreach v_tab in array array['clientes','areas','locais','sistemas','equipamentos','ferramentas']
  loop
    -- só restaura se o deleted_at ainda é o carimbo do arquivamento
    execute format($f$
      with alvo as (
        select g.id as log_id, g.row_id, g.deleted_at_anterior, g.ativo_anterior
        from pcm.e2e_arquivamento g
        join pcm.%I t on t.id = g.row_id and t.deleted_at = g.arquivado_em
        where g.tabela = %L and g.restaurado_em is null and (%L::uuid is null or g.lote = %L::uuid)
      ),
      upd as (
        update pcm.%I t set deleted_at = a.deleted_at_anterior, ativo = a.ativo_anterior
        from alvo a where t.id = a.row_id
        returning a.log_id
      )
      update pcm.e2e_arquivamento g set restaurado_em = clock_timestamp()
      from upd where g.id = upd.log_id
    $f$, v_tab, v_tab, p_lote, p_lote, v_tab);
    get diagnostics v_n = row_count;
    tabela := v_tab; restauradas := v_n;
    return next;
  end loop;

  perform set_config('app.auvo_sync_write', 'false', true);
end;
$$;

revoke all on function pcm.e2e_selecionar_arquivaveis() from public, anon, authenticated;
revoke all on function pcm.arquivar_dados_teste_e2e(boolean) from public, anon, authenticated;
revoke all on function pcm.restaurar_dados_teste_e2e(uuid) from public, anon, authenticated;
grant execute on function pcm.e2e_selecionar_arquivaveis() to service_role;
grant execute on function pcm.arquivar_dados_teste_e2e(boolean) to service_role;
grant execute on function pcm.restaurar_dados_teste_e2e(uuid) to service_role;
