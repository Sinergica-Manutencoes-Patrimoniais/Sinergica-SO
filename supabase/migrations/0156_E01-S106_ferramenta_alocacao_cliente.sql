-- 0156_E01-S106_ferramenta_alocacao_cliente.sql — Sinérgica SO
-- Story E01-S106. Ferramenta alocável em um cliente — distinto da alocação existente
-- ferramenta→funcionário/técnico (E01-S65, `FerramentaAlocacaoItem`/Auvo): aqui é ferramenta
-- emprestada/em uso num condomínio. Uma alocação ativa por ferramenta por vez; histórico mantido
-- (não é deletado, só `devolvida_em` preenchido).
--
-- Reverso:
--   drop table if exists pcm.ferramenta_alocacoes_cliente;

create table pcm.ferramenta_alocacoes_cliente (
  id            uuid        primary key default gen_random_uuid(),
  ferramenta_id uuid        not null references pcm.ferramentas (id),
  cliente_id    uuid        not null references pcm.clientes (id),
  alocada_em    timestamptz not null default now(),
  devolvida_em  timestamptz,
  created_by    uuid        references auth.users,
  updated_by    uuid        references auth.users
);

create index idx_ferramenta_alocacoes_cliente_ferramenta on pcm.ferramenta_alocacoes_cliente (ferramenta_id);
create index idx_ferramenta_alocacoes_cliente_cliente on pcm.ferramenta_alocacoes_cliente (cliente_id);
-- AC-4: no máximo 1 alocação ATIVA (devolvida_em is null) por ferramenta — índice parcial único
-- garante a invariante no banco, não só na aplicação.
create unique index idx_ferramenta_alocacao_ativa_unica on pcm.ferramenta_alocacoes_cliente (ferramenta_id)
  where devolvida_em is null;

alter table pcm.ferramenta_alocacoes_cliente enable row level security;
alter table pcm.ferramenta_alocacoes_cliente force row level security;

grant select, insert, update on pcm.ferramenta_alocacoes_cliente to authenticated;
grant select, insert, update, delete on pcm.ferramenta_alocacoes_cliente to service_role;

create policy "ferramenta_alocacoes_cliente_select" on pcm.ferramenta_alocacoes_cliente for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "ferramenta_alocacoes_cliente_insert" on pcm.ferramenta_alocacoes_cliente for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "ferramenta_alocacoes_cliente_update" on pcm.ferramenta_alocacoes_cliente for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
