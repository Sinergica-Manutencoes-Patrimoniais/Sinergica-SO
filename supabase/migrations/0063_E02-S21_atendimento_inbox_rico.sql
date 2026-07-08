-- 0063_E02-S21_atendimento_inbox_rico.sql — conteúdo rico e storage privado.
-- Reverso: remover policies/bucket atendimento-midias e colunas abaixo; restaurar check tipo_conteudo.

alter table atendimento.mensagens drop constraint if exists mensagens_tipo_conteudo_check;
alter table atendimento.mensagens add constraint mensagens_tipo_conteudo_check
  check (tipo_conteudo in ('texto', 'sistema', 'audio', 'midia', 'template', 'interativa')) not valid;
alter table atendimento.mensagens
  add column if not exists midia_url text,
  add column if not exists midia_nome text,
  add column if not exists midia_mime text,
  add column if not exists payload jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('atendimento-midias', 'atendimento-midias', false, 20971520)
on conflict (id) do nothing;

grant usage on schema storage to authenticated;
grant select, insert on storage.objects to authenticated;

create policy "atendimento_midias_select" on storage.objects for select to authenticated
using (bucket_id = 'atendimento-midias' and (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
));
create policy "atendimento_midias_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'atendimento-midias' and (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
));
