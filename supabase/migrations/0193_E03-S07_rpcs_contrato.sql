-- 0193_E03-S07_rpcs_contrato.sql — Sinérgica SO
-- Story E03-S07. Duas RPCs do Financeiro (publicadas — R1/R2, ADR-0019) e três do Comercial que as
-- orquestram. Nenhuma escrita cross-schema acontece fora de uma RPC publicada pelo dono do dado.

-- ═══════════════════════════ RPCs do Financeiro (publicadas) ════════════════

-- AC-4/AC-5: cria o plano de faturamento. `security definer` — quem chama (Comercial) nunca tem
-- `financeiro:escrita`; a guarda aqui decide quem pode criar em nome de um contrato comercial
-- (comercial:escrita OU financeiro:escrita OU superadmin — nunca "qualquer authenticated").
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

revoke all on function financeiro.fn_criar_plano_faturamento(uuid, text, integer, integer, date, date, uuid) from public;
grant execute on function financeiro.fn_criar_plano_faturamento(uuid, text, integer, integer, date, date, uuid) to authenticated;

comment on function financeiro.fn_criar_plano_faturamento(uuid, text, integer, integer, date, date, uuid) is
  'E03-S07 AC-4/AC-5: interface de escrita publicada pelo Financeiro (ADR-0019 R1/R2) — o Comercial '
  'nunca faz insert direto em financeiro.contratos. fn_gerar_recorrencias (E04-S04) não muda.';

-- AC-8: encerrar o plano — para de gerar recebível novo, mantém os já gerados (fn_gerar_recorrencias
-- só olha `status`/`fim`, nunca apaga `financeiro.lancamentos` existente).
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

  update financeiro.contratos
     set status = 'encerrado', fim = p_fim, updated_at = now(), updated_by = auth.uid()
   where id = p_financeiro_contrato_id;
end;
$$;

revoke all on function financeiro.fn_encerrar_plano_faturamento(uuid, date) from public;
grant execute on function financeiro.fn_encerrar_plano_faturamento(uuid, date) to authenticated;

-- ═══════════════════════════ RPCs do Comercial ═══════════════════════════
-- `comercial._fn_guarda_comercial_escrita()` já existe desde a migration 0184 (S04) — reusada aqui,
-- sem redefinir.

-- AC-2/AC-3: cria o contrato a partir da proposta aceita, pré-preenchido. `security invoker` — só
-- escreve em comercial.*, RLS normal decide (nenhuma escrita cross-schema aqui).
create or replace function comercial.fn_criar_contrato(p_proposta_id uuid)
returns comercial.contratos
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_proposta comercial.propostas%rowtype;
  v_cliente_id uuid;
  v_existente uuid;
  v_tipo text;
  v_contrato comercial.contratos%rowtype;
begin
  perform comercial._fn_guarda_comercial_escrita();

  select * into v_proposta from comercial.propostas where id = p_proposta_id;
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

revoke all on function comercial.fn_criar_contrato(uuid) from public;
grant execute on function comercial.fn_criar_contrato(uuid) to authenticated;

-- AC-4/AC-5/AC-7: ativação atômica — valida vigência/valor, cria o plano no Financeiro (RPC
-- publicada), marca ativo, move a oportunidade pra 'ganha' se ainda não estiver lá. Tudo numa
-- função só = tudo numa transação só: se `fn_criar_plano_faturamento` falhar, NADA desta função
-- fica gravado (AC-4, "operação atômica" — o pior defeito seria contrato ativo sem faturamento).
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

  -- AC-7: fecha a oportunidade em 'ganha', se ainda não estiver (S06 pode já ter movido no aceite
  -- da proposta — mover de novo pra mesma etapa é um no-op inofensivo, mas só faz o UPDATE se
  -- precisar, pra não gerar evento redundante em oportunidade_eventos).
  select e.tipo, o.etapa_id into v_etapa_atual_tipo, v_etapa_ganha
    from comercial.oportunidades o join comercial.etapas_funil e on e.id = o.etapa_id
   where o.id = (select oportunidade_id from comercial.propostas where id = v_contrato.proposta_id);

  if v_etapa_atual_tipo is distinct from 'ganha' then
    select id into v_etapa_ganha from comercial.etapas_funil
     where tipo = 'ganha' and ativo = true order by ordem limit 1;
    if v_etapa_ganha is not null then
      update comercial.oportunidades set etapa_id = v_etapa_ganha
       where id = (select oportunidade_id from comercial.propostas where id = v_contrato.proposta_id);
    end if;
  end if;

  return v_contrato;
end;
$$;

revoke all on function comercial.fn_ativar_contrato(uuid) from public;
grant execute on function comercial.fn_ativar_contrato(uuid) to authenticated;

comment on function comercial.fn_ativar_contrato(uuid) is
  'E03-S07 AC-4/AC-5/AC-7: ativação atômica. Chama financeiro.fn_criar_plano_faturamento (RPC '
  'publicada, R1/R2) dentro da MESMA transação — se falhar, nada aqui é gravado.';

-- AC-8: encerrar não apaga histórico — status vira encerrado, plano de faturamento para de gerar
-- parcela nova, parcelas já geradas continuam intactas (fn_gerar_recorrencias nunca apaga).
create or replace function comercial.fn_encerrar_contrato(
  p_contrato_id uuid,
  p_motivo text,
  p_data date default current_date
)
returns comercial.contratos
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_contrato comercial.contratos%rowtype;
begin
  perform comercial._fn_guarda_comercial_escrita();

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
    perform financeiro.fn_encerrar_plano_faturamento(v_contrato.financeiro_contrato_id, p_data);
  end if;

  update comercial.contratos
     set status = 'encerrado', encerrado_em = p_data, encerrado_motivo = p_motivo,
         updated_at = now(), updated_by = auth.uid()
   where id = p_contrato_id
   returning * into v_contrato;

  return v_contrato;
end;
$$;

revoke all on function comercial.fn_encerrar_contrato(uuid, text, date) from public;
grant execute on function comercial.fn_encerrar_contrato(uuid, text, date) to authenticated;
