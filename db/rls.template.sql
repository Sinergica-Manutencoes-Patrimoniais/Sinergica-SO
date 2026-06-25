-- Template de RLS (Row Level Security) — copie e adapte por tabela.
-- Regra do Padrão OS: toda tabela com dado de usuário tem RLS. Sem policy = sem acesso.
-- Single-repo: schema public. OS: troque public.<tabela> pelo schema do domínio e use FORCE
-- (ver os-layer/seguranca/os-grade.md). Papéis lidos do JWT: ceo, financeiro, analista.

-- 1) Habilitar RLS
alter table public.nome_tabela enable row level security;
-- (perfil OS) nem o owner escapa das policies:
-- alter table public.nome_tabela force row level security;

-- 2) Leitura — papéis com acesso
create policy "nome_tabela_select" on public.nome_tabela
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('ceo', 'financeiro', 'analista'));

-- 3) Inserção — papéis de escrita
create policy "nome_tabela_insert" on public.nome_tabela
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('ceo', 'financeiro'));

-- 4) Atualização
create policy "nome_tabela_update" on public.nome_tabela
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('ceo', 'financeiro'))
  with check (auth.jwt() ->> 'user_role' in ('ceo', 'financeiro'));

-- 5) Exclusão — mais restrito
create policy "nome_tabela_delete" on public.nome_tabela
  for delete to authenticated
  using (auth.jwt() ->> 'user_role' = 'ceo');

-- ── Multi-tenant (quando houver workspace/org) ────────────────────────────────
-- Acrescente o isolamento por tenant ao USING/WITH CHECK:
--   using (workspace_id = (auth.jwt() ->> 'workspace_id')::uuid and auth.jwt() ->> 'user_role' in (...))

-- ── Verificação (rode após aplicar) ───────────────────────────────────────────
-- RLS ativa por tabela:
--   select tablename, rowsecurity, forcerowsecurity from pg_tables where schemaname = 'public';
-- Policies existentes:
--   select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public';

-- ── service_role ──────────────────────────────────────────────────────────────
-- service_role IGNORA RLS. Use só no servidor (Edge Function), nunca no client.
-- Em tabelas append-only (audit), negue update/delete inclusive para service_role (perfil OS).
