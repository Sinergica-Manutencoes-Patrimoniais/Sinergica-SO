-- 0164_E01-S119_anotacoes_chamado.sql — anotações internas append-only, vinculadas ao Chamado
-- e não à OS. Assim preservam o histórico quando o Chamado é convertido em OS.

create table pcm.chamados_anotacoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references pcm.chamados (id) on delete cascade,
  texto text not null check (nullif(btrim(texto), '') is not null and char_length(texto) <= 5000),
  autor_id uuid not null references auth.users (id) default auth.uid(),
  autor_nome text not null default 'Usuário',
  created_at timestamptz not null default now()
);

create index idx_chamados_anotacoes_chamado_created_at
  on pcm.chamados_anotacoes (chamado_id, created_at desc);

alter table pcm.chamados_anotacoes enable row level security;
alter table pcm.chamados_anotacoes force row level security;

grant select, insert on pcm.chamados_anotacoes to authenticated;
grant select, insert, update, delete on pcm.chamados_anotacoes to service_role;

create policy "chamados_anotacoes_select" on pcm.chamados_anotacoes for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "chamados_anotacoes_insert" on pcm.chamados_anotacoes for insert to authenticated
  with check (
    autor_id = auth.uid()
    and (
      auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
    )
  );

create or replace function pcm.preencher_autor_nome_chamado_anotacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(nullif(btrim(nome), ''), 'Usuário')
    into new.autor_nome
    from config.usuarios
   where user_id = new.autor_id;
  new.autor_nome := coalesce(new.autor_nome, 'Usuário');
  return new;
end;
$$;

create trigger preencher_autor_nome_chamado_anotacao
before insert on pcm.chamados_anotacoes
for each row execute function pcm.preencher_autor_nome_chamado_anotacao();
