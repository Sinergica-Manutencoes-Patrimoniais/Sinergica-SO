-- Template de RLS (Row Level Security) — copie e adapte por tabela.
-- Regra do Padrão OS: toda tabela com dado de usuário tem RLS. Sem policy = sem acesso.
-- Sinérgica SO: tabelas de domínio devem usar permissão por módulo via claim `user_modulos`
-- (ADR-0004). `user_role = 'superadmin'` segue como bypass explícito.

-- 1) Habilitar RLS
alter table public.nome_tabela enable row level security;
-- (perfil OS) nem o owner escapa das policies:
-- alter table public.nome_tabela force row level security;

-- 2) GRANT de privilégio (OBRIGATÓRIO — não é opcional)
-- ⚠️ Pegadinha clássica do Postgres: RLS só é avaliada DEPOIS do privilégio de tabela. Sem o
-- GRANT abaixo, o Postgres nega ANTES de olhar a policy — a tabela fica inacessível mesmo com a
-- policy "certa" (quebra em produção, não só no teste). Toda tabela com RLS precisa disto —
-- checado por máquina em `npm run lint:migrations` (falha se um CREATE POLICY não tiver GRANT).
-- (Em schema de domínio no perfil OS, some: `grant usage on schema <schema> to authenticated;`)
grant select, insert, update, delete on public.nome_tabela to authenticated;
-- A RLS é que decide QUAIS linhas/colunas cada papel acessa; o GRANT só abre a porta da tabela.

-- 3) Leitura — módulo com `leitura` ou `escrita`
create policy "nome_tabela_select" on public.nome_tabela
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> '<modulo>' in ('leitura', 'escrita')
  );

-- 4) Inserção — módulo com `escrita`
create policy "nome_tabela_insert" on public.nome_tabela
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> '<modulo>' = 'escrita'
  );

-- 5) Atualização
create policy "nome_tabela_update" on public.nome_tabela
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> '<modulo>' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> '<modulo>' = 'escrita'
  );

-- 6) Exclusão — mais restrito
create policy "nome_tabela_delete" on public.nome_tabela
  for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin');

-- ── Multi-tenant (quando houver workspace/org) ────────────────────────────────
-- Acrescente o isolamento por tenant ao USING/WITH CHECK:
--   using (
--     workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
--     and (auth.jwt() ->> 'user_role' = 'superadmin'
--       or auth.jwt() -> 'user_modulos' ->> '<modulo>' in ('leitura', 'escrita'))
--   )

-- ── Verificação (rode após aplicar) ───────────────────────────────────────────
-- RLS ativa por tabela:
--   select tablename, rowsecurity, forcerowsecurity from pg_tables where schemaname = 'public';
-- Policies existentes:
--   select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public';

-- ── service_role ──────────────────────────────────────────────────────────────
-- service_role IGNORA RLS. Use só no servidor (Edge Function), nunca no client.
-- Em tabelas append-only (audit), negue update/delete inclusive para service_role (perfil OS).
