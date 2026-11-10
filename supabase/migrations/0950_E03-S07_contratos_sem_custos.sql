-- ADR-0725: manter SECURITY INVOKER, RLS e funções Financeiro sem alteração.
-- Reverso operacional exige definição compatível sem apagar contrato ou plano.
create or replace function comercial.fn_criar_contrato(p_proposta_id uuid)
returns comercial.contratos
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_proposta comercial.propostas_sem_custos%rowtype;
  v_cliente_id uuid;
  v_existente uuid;
  v_tipo text;
  v_contrato comercial.contratos%rowtype;
begin
  perform comercial._fn_guarda_comercial_escrita();

  select * into v_proposta from comercial.propostas_sem_custos where id = p_proposta_id;
  if not found then
    raise exception 'proposta % não encontrada', p_proposta_id using errcode = 'no_data_found';
  end if;
  if v_proposta.status <> 'aceita' then
    raise exception 'só proposta aceita gera contrato (status atual: %)', v_proposta.status
      using errcode = 'check_violation';
  end if;

  select id into v_existente from comercial.contratos where proposta_id = p_proposta_id;
  if v_existente is not null then
    raise exception 'esta proposta já gerou o contrato %', v_existente using errcode = 'unique_violation';
  end if;

  select cliente_id into v_cliente_id
    from comercial.oportunidades where id = v_proposta.oportunidade_id;

  -- Mapeia o tipo de proposta (S04: levantamento/volante/residente/simples) pro tipo de contrato
  -- (residente/volante/avulso) — 'simples' e 'levantamento' viram 'avulso' por padrão, editável
  -- antes de ativar (AC-2).
  v_tipo := case v_proposta.tipo
    when 'residente' then 'residente'
    when 'volante' then 'volante'
    else 'avulso'
  end;

  insert into comercial.contratos
    (proposta_id, cliente_id, tipo, valor_mensal_centavos, vigencia_inicio, escopo, created_by)
  values
    (p_proposta_id, v_cliente_id, v_tipo,
     case when v_tipo = 'avulso' then null else v_proposta.preco_centavos end,
     current_date,
     case when v_proposta.escopo is null then '[]'::jsonb
          else jsonb_build_array(jsonb_build_object('descricao', v_proposta.escopo)) end,
     auth.uid())
  returning * into v_contrato;

  return v_contrato;
end;
$$;

create or replace function comercial.fn_ativar_contrato(p_contrato_id uuid)
returns comercial.contratos
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_contrato comercial.contratos%rowtype;
  v_plano financeiro.contratos%rowtype;
  v_etapa_atual_tipo text;
  v_etapa_ganha uuid;
  v_oportunidade_id uuid;
begin
  perform comercial._fn_guarda_comercial_escrita();

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
    select * into v_plano from financeiro.fn_criar_plano_faturamento(
      v_contrato.cliente_id,
      'Contrato comercial ' || v_contrato.tipo || ' — ' || v_contrato.id::text,
      v_contrato.valor_mensal_centavos,
      v_contrato.dia_vencimento,
      v_contrato.vigencia_inicio,
      v_contrato.vigencia_fim,
      v_contrato.id
    );
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

