-- ADR-0724: incremento restrito; não resolve vínculo financeiro arbitrário ou S184.
-- Reverso operacional: desativar consumidores afetados, preservar dados e revisar ACL;
-- não remover controles de permissão atual sem decisão de segurança.
create function config.sso_e03_s07_modulo_atual(p_modulo text, p_escrita boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1 from config.usuarios u
    where u.user_id = auth.uid() and u.ativo and u.papel = auth.jwt()->>'user_role'
      and u.papel <> 'cliente-sindico' and p_modulo in ('comercial','financeiro') and p_escrita is not null
      and (u.papel = 'superadmin' or exists (
        select 1 from config.resolver_permissoes_modulo(u.user_id) m
        where m.modulo = p_modulo and (m.nivel = 'escrita' or (not p_escrita and m.nivel = 'leitura'))
      ))
  ), false);
$$;
revoke all on function config.sso_e03_s07_modulo_atual(text,boolean) from public,anon,authenticated,service_role;
grant execute on function config.sso_e03_s07_modulo_atual(text,boolean) to authenticated;

-- Políticas restritivas complementam, sem substituir, as permissivas já existentes.
create policy e03_s07_contratos_leitura_atual on comercial.contratos as restrictive for select to authenticated
  using (config.sso_e03_s07_modulo_atual('comercial', false));
create policy e03_s07_contratos_insercao_atual on comercial.contratos as restrictive for insert to authenticated
  with check (config.sso_e03_s07_modulo_atual('comercial', true));
create policy e03_s07_contratos_alteracao_atual on comercial.contratos as restrictive for update to authenticated
  using (config.sso_e03_s07_modulo_atual('comercial', true))
  with check (config.sso_e03_s07_modulo_atual('comercial', true));

create or replace function financeiro.fn_criar_plano_faturamento(
  p_cliente_id uuid,
  p_descricao text,
  p_valor_mensal_centavos integer,
  p_dia_vencimento integer,
  p_inicio date,
  p_fim date,
  p_comercial_contrato_id uuid
)
returns financeiro.contratos
language plpgsql
security definer
set search_path = financeiro, pg_temp
as $$
declare
  v_contrato financeiro.contratos%rowtype;
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') = 'escrita'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') = 'escrita',
    false
  ) is not true then
    raise exception 'permission denied for function fn_criar_plano_faturamento' using errcode = '42501';
  end if;

  if not coalesce(
    (auth.jwt()->>'user_role' = 'superadmin' and config.sso_e03_s07_modulo_atual('comercial', true))
    or (auth.jwt()->'user_modulos'->>'comercial' = 'escrita' and config.sso_e03_s07_modulo_atual('comercial', true))
    or (auth.jwt()->'user_modulos'->>'financeiro' = 'escrita' and config.sso_e03_s07_modulo_atual('financeiro', true)), false) then
    raise exception 'permissao_atual_negada' using errcode = '42501';
  end if;

  insert into financeiro.contratos
    (cliente_id, descricao, valor_mensal_centavos, dia_vencimento, inicio, fim,
     comercial_contrato_id, created_by)
  values
    (p_cliente_id, p_descricao, p_valor_mensal_centavos, p_dia_vencimento, p_inicio, p_fim,
     p_comercial_contrato_id, auth.uid())
  returning * into v_contrato;

  return v_contrato;
end;
$$;

create or replace function financeiro.fn_encerrar_plano_faturamento(
  p_financeiro_contrato_id uuid,
  p_fim date
)
returns void
language plpgsql
security definer
set search_path = financeiro, pg_temp
as $$
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') = 'escrita'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') = 'escrita',
    false
  ) is not true then
    raise exception 'permission denied for function fn_encerrar_plano_faturamento' using errcode = '42501';
  end if;

  if not coalesce(
    (auth.jwt()->>'user_role' = 'superadmin' and config.sso_e03_s07_modulo_atual('comercial', true))
    or (auth.jwt()->'user_modulos'->>'comercial' = 'escrita' and config.sso_e03_s07_modulo_atual('comercial', true))
    or (auth.jwt()->'user_modulos'->>'financeiro' = 'escrita' and config.sso_e03_s07_modulo_atual('financeiro', true)), false) then
    raise exception 'permissao_atual_negada' using errcode = '42501';
  end if;

  update financeiro.contratos
     set status = 'encerrado', fim = p_fim, updated_at = now(), updated_by = auth.uid()
   where id = p_financeiro_contrato_id;
end;
$$;

