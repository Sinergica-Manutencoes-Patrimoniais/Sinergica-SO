-- ADR-0727. Diagnóstico apenas: depende de revisão adversarial e rollout coordenado.
-- Restringir API legada muda contrato de Comercial; preserve Financeiro e dados existentes.
create policy e03_s07_contrato_insercao_rascunho on comercial.contratos as restrictive for insert to authenticated
  with check (status = 'rascunho' and financeiro_contrato_id is null and encerrado_em is null and encerrado_motivo is null);
create policy e03_s07_contrato_edicao_rascunho on comercial.contratos as restrictive for update to authenticated
  using (status = 'rascunho') with check (status = 'rascunho');
revoke update on comercial.contratos from authenticated;
grant update (tipo,valor_mensal_centavos,dia_vencimento,vigencia_inicio,vigencia_fim,reajuste_indice,reajuste_mes,escopo,updated_at,updated_by) on comercial.contratos to authenticated;

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
   where id = p_financeiro_contrato_id;
end;
$$;

-- Interface financeira interna: somente o proprietário das funções mediadoras a executa.
create function financeiro.sso_e03_s07_criar_plano_interno(p_contrato_id uuid)
returns financeiro.contratos language plpgsql security definer set search_path = '' as $$
declare c comercial.contratos%rowtype; v financeiro.contratos%rowtype;
begin
  if config.sso_e03_s07_modulo_atual('comercial',true) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from comercial.contratos where id=p_contrato_id for update;
  if not found or c.status <> 'rascunho' or c.tipo not in ('residente','volante') or c.financeiro_contrato_id is not null or c.valor_mensal_centavos is null or c.valor_mensal_centavos <= 0 then raise exception 'contrato_invalido' using errcode='23514'; end if;
  insert into financeiro.contratos(cliente_id,descricao,valor_mensal_centavos,dia_vencimento,inicio,fim,comercial_contrato_id,created_by)
    values(c.cliente_id,'Contrato comercial '||c.tipo||' — '||c.id::text,c.valor_mensal_centavos,c.dia_vencimento,c.vigencia_inicio,c.vigencia_fim,c.id,auth.uid()) returning * into v;
  return v;
end; $$;
revoke all on function financeiro.sso_e03_s07_criar_plano_interno(uuid) from public,anon,authenticated,service_role;

create function financeiro.sso_e03_s07_encerrar_plano_interno(p_contrato_id uuid,p_fim date)
returns void language plpgsql security definer set search_path = '' as $$
declare c comercial.contratos%rowtype;
begin
  if config.sso_e03_s07_modulo_atual('comercial',true) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from comercial.contratos where id=p_contrato_id for update;
  if not found or c.status not in ('ativo','suspenso') or c.financeiro_contrato_id is null then raise exception 'contrato_invalido' using errcode='23514'; end if;
  update financeiro.contratos set status='encerrado',fim=p_fim,updated_at=now(),updated_by=auth.uid()
    where id=c.financeiro_contrato_id and comercial_contrato_id=c.id and cliente_id=c.cliente_id;
  if not found then raise exception 'plano_indisponivel' using errcode='23514'; end if;
end; $$;
revoke all on function financeiro.sso_e03_s07_encerrar_plano_interno(uuid,date) from public,anon,authenticated,service_role;

create or replace function comercial.fn_ativar_contrato(p_contrato_id uuid)
returns comercial.contratos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato comercial.contratos%rowtype;
  v_plano financeiro.contratos%rowtype;
  v_etapa_atual_tipo text;
  v_etapa_ganha uuid;
  v_oportunidade_id uuid;
begin
  perform comercial._fn_guarda_comercial_escrita();
  if config.sso_e03_s07_modulo_atual('comercial', true) is not true then
    raise exception 'permissao_atual_negada' using errcode = '42501';
  end if;

  select * into v_contrato from comercial.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'contrato % não encontrado', p_contrato_id using errcode = 'no_data_found';
  end if;
  if v_contrato.status <> 'rascunho' then
    raise exception 'só contrato em rascunho pode ser ativado (status atual: %)', v_contrato.status
      using errcode = 'check_violation';
  end if;
  if v_contrato.vigencia_fim is not null and v_contrato.vigencia_fim < current_date then
    raise exception 'vigência encerrada em % — não pode ativar', v_contrato.vigencia_fim
      using errcode = '23514';
  end if;
  -- Edge case da spec: valor zero é recusado — mas só pra quem DEVERIA ter valor. 'avulso' nunca
  -- gera plano de faturamento (é o outro caminho que a spec menciona), então passa sem valor.
  if v_contrato.tipo <> 'avulso'
     and (v_contrato.valor_mensal_centavos is null or v_contrato.valor_mensal_centavos <= 0) then
    raise exception 'valor mensal precisa ser maior que zero pra ativar contrato do tipo %', v_contrato.tipo
      using errcode = '23514';
  end if;

  -- Bloqueia a oportunidade antes de gerar plano; ausência nunca produz contrato ativo.
  select p.oportunidade_id into v_oportunidade_id from comercial.propostas_sem_custos p
    where p.id = v_contrato.proposta_id and p.status = 'aceita';
  if v_oportunidade_id is null then
    raise exception 'proposta_ou_oportunidade_indisponivel' using errcode = '23514';
  end if;
  select e.tipo into v_etapa_atual_tipo from comercial.oportunidades o
    join comercial.etapas_funil e on e.id = o.etapa_id
    where o.id = v_oportunidade_id and o.cliente_id = v_contrato.cliente_id for update of o;
  if not found then raise exception 'oportunidade_indisponivel' using errcode = '23514'; end if;
  if v_etapa_atual_tipo is distinct from 'ganha' then
    select id into v_etapa_ganha from comercial.etapas_funil
      where tipo = 'ganha' and ativo = true order by ordem limit 1;
    if v_etapa_ganha is null then raise exception 'etapa_ganha_indisponivel' using errcode = '23514'; end if;
  end if;

  -- AC-4/AC-5: só tipo residente/volante gera plano de faturamento recorrente.
  if v_contrato.tipo <> 'avulso' then
    select * into v_plano from financeiro.sso_e03_s07_criar_plano_interno(v_contrato.id);
  end if;

  update comercial.contratos
     set status = 'ativo',
         financeiro_contrato_id = v_plano.id, -- null quando avulso, de propósito
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_contrato_id
   returning * into v_contrato;

  if v_etapa_atual_tipo is distinct from 'ganha' then
    update comercial.oportunidades set etapa_id = v_etapa_ganha where id = v_oportunidade_id;
    if not found then raise exception 'oportunidade_indisponivel' using errcode = '23514'; end if;
  end if;

  return v_contrato;
end;
$$;

create or replace function comercial.fn_encerrar_contrato(
  p_contrato_id uuid,
  p_motivo text,
  p_data date default current_date
)
returns comercial.contratos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato comercial.contratos%rowtype;
begin
  perform comercial._fn_guarda_comercial_escrita();
  if config.sso_e03_s07_modulo_atual('comercial', true) is not true then
    raise exception 'permissao_atual_negada' using errcode = '42501';
  end if;

  if nullif(btrim(p_motivo), '') is null then
    raise exception 'motivo é obrigatório para encerrar contrato' using errcode = '23514';
  end if;

  select * into v_contrato from comercial.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'contrato % não encontrado', p_contrato_id using errcode = 'no_data_found';
  end if;
  if v_contrato.status not in ('ativo', 'suspenso') then
    raise exception 'só contrato ativo ou suspenso pode ser encerrado (status atual: %)', v_contrato.status
      using errcode = 'check_violation';
  end if;

  if v_contrato.financeiro_contrato_id is not null then
    perform financeiro.sso_e03_s07_encerrar_plano_interno(v_contrato.id, p_data);
  end if;

  update comercial.contratos
     set status = 'encerrado', encerrado_em = p_data, encerrado_motivo = p_motivo,
         updated_at = now(), updated_by = auth.uid()
   where id = p_contrato_id
   returning * into v_contrato;

  return v_contrato;
end;
$$;

