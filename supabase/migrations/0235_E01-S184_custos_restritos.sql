-- E01-S184: acesso à composição interna limitado ao administrador ativo.
-- Reverso: remover as policies s184_custos_restritos e a view propostas_sem_custos;
-- essa reversão libera custos para qualquer pessoa com módulo Comercial/PCM.
create or replace function config.s184_pode_ver_custos()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from config.usuarios u where u.user_id = auth.uid()
    and u.ativo and u.papel = 'superadmin' and auth.jwt() ->> 'user_role' = 'superadmin');
$$;
revoke all on function config.s184_pode_ver_custos() from public, anon;
grant execute on function config.s184_pode_ver_custos() to authenticated;

create policy s184_custos_restritos on comercial.propostas as restrictive
  for select to authenticated using (config.s184_pode_ver_custos());
create policy s184_custos_restritos on comercial.proposta_itens as restrictive
  for select to authenticated using (config.s184_pode_ver_custos());
create policy s184_custos_restritos on comercial.proposta_versoes as restrictive
  for select to authenticated using (config.s184_pode_ver_custos());
create policy s184_custos_restritos on comercial.proposta_forcos_piso as restrictive
  for select to authenticated using (config.s184_pode_ver_custos());
create policy s184_custos_restritos on pcm.orcamentos_servico as restrictive
  for select to authenticated using (config.s184_pode_ver_custos());

create or replace view comercial.propostas_sem_custos with (security_barrier = true) as
select p.id, p.oportunidade_id, p.tipo, p.status, p.escopo, p.preco_centavos,
  p.valido_ate, p.versao_atual, p.created_at
from comercial.propostas p
where p.deleted_at is null and config.s184_acesso_interno_atual('comercial');
grant select on comercial.propostas_sem_custos to authenticated;
