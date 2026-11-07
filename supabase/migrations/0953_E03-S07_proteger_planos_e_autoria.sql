-- ADR-0729: sem alterações de dados; ativação depende de revisão/rollout coordenado.
-- Políticas antigas permanecem e se combinam com estes limites restritivos.
create policy e03_s07_financeiro_insert_sem_vinculo on financeiro.contratos as restrictive for insert to authenticated
  with check (comercial_contrato_id is null);
create policy e03_s07_financeiro_update_sem_vinculo on financeiro.contratos as restrictive for update to authenticated
  using (comercial_contrato_id is null) with check (comercial_contrato_id is null);
create policy e03_s07_financeiro_delete_sem_vinculo on financeiro.contratos as restrictive for delete to authenticated
  using (comercial_contrato_id is null);
create policy e03_s07_contrato_autoria_atual on comercial.contratos as restrictive for insert to authenticated
  with check (created_by = auth.uid() and (updated_by is null or updated_by = auth.uid()));
revoke insert on comercial.contratos from authenticated;
grant insert (id,proposta_id,cliente_id,tipo,valor_mensal_centavos,dia_vencimento,vigencia_inicio,vigencia_fim,reajuste_indice,reajuste_mes,escopo,created_by,updated_by) on comercial.contratos to authenticated;

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
set search_path = ''
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
    (auth.jwt()->>'user_role' = 'superadmin' and config.sso_e03_s07_modulo_atual('financeiro', true))
    or (auth.jwt()->'user_modulos'->>'financeiro' = 'escrita' and config.sso_e03_s07_modulo_atual('financeiro', true)), false) then
    raise exception 'permissao_atual_negada' using errcode = '42501';
  end if;

  if p_comercial_contrato_id is not null then raise exception 'vinculo_comercial_requer_mediacao' using errcode='42501'; end if;

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
set search_path = ''
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
    (auth.jwt()->>'user_role' = 'superadmin' and config.sso_e03_s07_modulo_atual('financeiro', true))
    or (auth.jwt()->'user_modulos'->>'financeiro' = 'escrita' and config.sso_e03_s07_modulo_atual('financeiro', true)), false) then
    raise exception 'permissao_atual_negada' using errcode = '42501';
  end if;

  update financeiro.contratos
     set status = 'encerrado', fim = p_fim, updated_at = now(), updated_by = auth.uid()
   where id = p_financeiro_contrato_id and comercial_contrato_id is null;
  if not found then raise exception 'plano_indisponivel_ou_vinculado' using errcode='42501'; end if;
end;
$$;

create or replace function financeiro.sso_e03_s07_criar_plano_interno(p_contrato_id uuid)
returns financeiro.contratos language plpgsql security definer set search_path = '' as $$
declare c comercial.contratos%rowtype; v financeiro.contratos%rowtype;
begin
  if config.sso_e03_s07_modulo_atual('comercial',true) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from comercial.contratos where id=p_contrato_id for update;
  if not found or c.status <> 'rascunho' or c.tipo not in ('residente','volante') or c.financeiro_contrato_id is not null or c.valor_mensal_centavos is null or c.valor_mensal_centavos <= 0 then raise exception 'contrato_invalido' using errcode='23514'; end if;
  if exists(select 1 from financeiro.contratos where comercial_contrato_id=c.id) then raise exception 'plano_comercial_ja_existente' using errcode='23505'; end if;
  insert into financeiro.contratos(cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio,fim,comercial_contrato_id,created_by)
    values(c.cliente_id,'Contrato comercial '||c.tipo||' — '||c.id::text,c.valor_mensal_centavos,c.dia_vencimento,c.vigencia_inicio,c.vigencia_fim,c.id,auth.uid()) returning * into v;
  return v;
end; $$;

