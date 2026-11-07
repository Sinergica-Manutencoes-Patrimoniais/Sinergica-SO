-- E01-S184: comprovantes só podem ser acessados com permissão financeira atual.
-- Reverso: remover as policies s184_comprovante_* e a função s184_financeiro_escrita_atual;
-- reverter permite que JWTs antigos continuem acessando comprovantes privados.
create or replace function config.s184_financeiro_escrita_atual()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from config.usuarios u
    where u.user_id = auth.uid() and u.ativo and u.papel = auth.jwt() ->> 'user_role'
      and u.papel <> 'cliente-sindico'
      and (u.papel = 'superadmin' or exists (
        select 1 from config.resolver_permissoes_modulo(u.user_id) m
        where m.modulo = 'financeiro' and m.nivel = 'escrita'
      )));
$$;
revoke all on function config.s184_financeiro_escrita_atual() from public, anon;
grant execute on function config.s184_financeiro_escrita_atual() to authenticated;

create policy s184_comprovante_leitura_atual on storage.objects as restrictive
  for select to authenticated using (bucket_id <> 'financeiro-comprovantes' or config.s184_acesso_interno_atual('financeiro'));
create policy s184_comprovante_insercao_atual on storage.objects as restrictive
  for insert to authenticated with check (bucket_id <> 'financeiro-comprovantes' or config.s184_financeiro_escrita_atual());
create policy s184_comprovante_alteracao_atual on storage.objects as restrictive
  for update to authenticated using (bucket_id <> 'financeiro-comprovantes' or config.s184_financeiro_escrita_atual())
  with check (bucket_id <> 'financeiro-comprovantes' or config.s184_financeiro_escrita_atual());
create policy s184_comprovante_exclusao_atual on storage.objects as restrictive
  for delete to authenticated using (bucket_id <> 'financeiro-comprovantes' or config.s184_financeiro_escrita_atual());
