-- E01-S184: acesso direto ao conteúdo interno exige usuário e permissão atuais.
-- Reverso: remover policies s184_acesso_interno_atual das tabelas abaixo e a função;
-- isso volta a aceitar privilégios revogados presentes em JWTs antigos.
create or replace function config.s184_acesso_interno_atual(p_modulo text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from config.usuarios u
    where u.user_id = auth.uid() and u.ativo
      and u.papel = auth.jwt() ->> 'user_role'
      and u.papel <> 'cliente-sindico'
      and (u.papel = 'superadmin' or exists (
        select 1 from config.resolver_permissoes_modulo(u.user_id) m
        where m.modulo = p_modulo and m.nivel in ('leitura', 'escrita')
      ))
  );
$$;
revoke all on function config.s184_acesso_interno_atual(text) from public, anon;
grant execute on function config.s184_acesso_interno_atual(text) to authenticated;

create policy s184_acesso_interno_atual on comercial.propostas as restrictive
  for select to authenticated using (config.s184_acesso_interno_atual('comercial'));
create policy s184_acesso_interno_atual on comercial.proposta_itens as restrictive
  for select to authenticated using (config.s184_acesso_interno_atual('comercial'));
create policy s184_acesso_interno_atual on comercial.proposta_versoes as restrictive
  for select to authenticated using (config.s184_acesso_interno_atual('comercial'));
create policy s184_acesso_interno_atual on comercial.proposta_forcos_piso as restrictive
  for select to authenticated using (config.s184_acesso_interno_atual('comercial'));
create policy s184_acesso_interno_atual on pcm.orcamentos_servico as restrictive
  for select to authenticated using (config.s184_acesso_interno_atual('pcm'));
