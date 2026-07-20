-- 0104_E01-S05_pmoc_laudos_bucket.sql — Sinérgica SO
-- Bucket Storage pro laudo PDF de visita PMOC (design/spec E01-S05 AC-3). Privado, RLS por módulo,
-- mesmo padrão de 0091 (inspecoes-midia)/0063 (atendimento-midias). A Edge Function
-- `pmoc-generate-pdf` grava aqui com `service_role` (bypassa RLS); as policies abaixo são pra
-- leitura/gestão pela UI autenticada (download do laudo já gerado).
--
-- Também adiciona `config.fn_obter_segredo_integracao_interno` — o schema `vault` não é exposto
-- via PostgREST (não está em `supabase/config.toml` `schemas`), então a Edge Function
-- `pmoc-generate-pdf` (roda com `service_role`) precisa de uma RPC pra ler o segredo do e-mail
-- (E00-S12). Granted só pra `service_role` — nunca `authenticated`/`anon`, o valor decriptado
-- nunca alcança a UI (diferente de `fn_integracao_tem_segredo`, que só devolve existência).
--
-- Reverso:
--   delete from storage.objects where bucket_id = 'pmoc-laudos';
--   delete from storage.buckets where id = 'pmoc-laudos';
--   drop policy if exists "pmoc_laudos_select" on storage.objects;
--   drop policy if exists "pmoc_laudos_insert" on storage.objects;
--   drop function if exists config.fn_obter_segredo_integracao_interno(text);

insert into storage.buckets (id, name, public, file_size_limit)
values ('pmoc-laudos', 'pmoc-laudos', false, 10485760) -- 10MB (laudo é texto/tabela, não mídia)
on conflict (id) do nothing;

grant usage on schema storage to authenticated;
grant select, insert on storage.objects to authenticated;

create policy "pmoc_laudos_select" on storage.objects for select to authenticated
using (bucket_id = 'pmoc-laudos' and (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
));
create policy "pmoc_laudos_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'pmoc-laudos' and (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
));

-- Só service_role (Edge Function) — nunca authenticated/anon. Sem checagem de user_role interna
-- (não há JWT de usuário quando chamado por service_role; a GRANT já é a barreira).
create or replace function config.fn_obter_segredo_integracao_interno(p_chave text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_chave limit 1;
$$;

revoke all on function config.fn_obter_segredo_integracao_interno(text) from public, anon, authenticated;
grant execute on function config.fn_obter_segredo_integracao_interno(text) to service_role;
