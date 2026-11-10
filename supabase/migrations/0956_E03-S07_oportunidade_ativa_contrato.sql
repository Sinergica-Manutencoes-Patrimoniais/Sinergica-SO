-- ADR-0731: revalidação da oportunidade, sem mudança de assinatura ou ACL.
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
    where o.id = v_oportunidade_id and o.cliente_id = v_contrato.cliente_id and o.deleted_at is null for update of o;
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

