-- 0184_E03-S04_rpcs_proposta.sql — Sinérgica SO
-- Story E03-S04. RPCs que tornam atômicas as operações de várias tabelas (proposta + itens +
-- versão), em vez de sequência de chamadas do client com risco de ficar pela metade.
--
-- A FÓRMULA de preço (custo→piso→preço) não é recalculada aqui — vem pronta do client
-- (`domain/precificacao.ts`, S03, já testado). A RPC só persiste; quem garante piso ≥ preço é o
-- trigger `fn_proposta_valida_piso` (migration 0183), que dispara em qualquer UPDATE desta
-- tabela, inclusive o feito aqui dentro.
--
-- Rollback:
--   drop function if exists comercial.fn_duplicar_proposta(uuid);
--   drop function if exists comercial.fn_salvar_composicao_proposta(uuid, jsonb, bigint, bigint, bigint, bigint, text, text, date);
--   drop function if exists comercial.fn_criar_proposta(uuid, text);

create or replace function comercial._fn_guarda_comercial_escrita()
returns void
language plpgsql
security invoker
set search_path = pg_temp
as $$
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') = 'escrita',
    false
  ) is not true then
    raise exception 'permission denied — requer comercial:escrita' using errcode = '42501';
  end if;
end;
$$;

-- ─────────────────────────── AC-2: criar proposta ───────────────────────────

create or replace function comercial.fn_criar_proposta(p_oportunidade_id uuid, p_tipo text)
returns comercial.propostas
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_proposta comercial.propostas%rowtype;
begin
  perform comercial._fn_guarda_comercial_escrita();

  insert into comercial.propostas (oportunidade_id, tipo, created_by)
  values (p_oportunidade_id, p_tipo, auth.uid())
  returning * into v_proposta;

  insert into comercial.proposta_versoes (proposta_id, versao, payload, criado_por)
  values (v_proposta.id, 1, to_jsonb(v_proposta), auth.uid());

  return v_proposta;
end;
$$;

revoke all on function comercial.fn_criar_proposta(uuid, text) from public;
grant execute on function comercial.fn_criar_proposta(uuid, text) to authenticated;

-- ─────────────────────────── AC-3/AC-5: salvar composição ───────────────────

create or replace function comercial.fn_salvar_composicao_proposta(
  p_proposta_id uuid,
  p_itens jsonb,               -- array de {tipo,descricao,nivel_id,material_id,quantidade,custo_unitario_centavos,total_centavos}
  p_custo_total_centavos bigint,
  p_piso_centavos bigint,
  p_preco_sugerido_centavos bigint,
  p_preco_centavos bigint,
  p_escopo text default null,
  p_observacoes text default null,
  p_valido_ate date default null
)
returns comercial.propostas
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_proposta comercial.propostas%rowtype;
  v_item jsonb;
begin
  perform comercial._fn_guarda_comercial_escrita();

  select * into v_proposta from comercial.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposta_id using errcode = 'no_data_found';
  end if;

  -- AC-7: espelha `podeEditar` do domínio — status terminal nunca edita, nem por aqui.
  if v_proposta.status in ('enviada', 'aceita', 'recusada', 'cancelada') then
    raise exception 'Proposta em status "%" não pode ser editada — duplique para uma nova versão.',
      v_proposta.status using errcode = 'check_violation';
  end if;

  delete from comercial.proposta_itens where proposta_id = p_proposta_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    insert into comercial.proposta_itens
      (proposta_id, tipo, descricao, nivel_id, material_id, quantidade,
       custo_unitario_centavos, total_centavos, created_by)
    values
      (p_proposta_id,
       v_item ->> 'tipo',
       v_item ->> 'descricao',
       nullif(v_item ->> 'nivel_id', '')::uuid,
       nullif(v_item ->> 'material_id', '')::uuid,
       (v_item ->> 'quantidade')::numeric,
       (v_item ->> 'custo_unitario_centavos')::bigint,
       (v_item ->> 'total_centavos')::bigint,
       auth.uid());
  end loop;

  -- O UPDATE dispara trg_propostas_piso — preco < piso é recusado aqui, mesma guarda de sempre.
  update comercial.propostas
     set custo_total_centavos = p_custo_total_centavos,
         piso_centavos = p_piso_centavos,
         preco_sugerido_centavos = p_preco_sugerido_centavos,
         preco_centavos = p_preco_centavos,
         desconto_pct = case when p_preco_sugerido_centavos > 0
           then round((1 - (p_preco_centavos::numeric / p_preco_sugerido_centavos)) * 100, 3)
           else 0 end,
         escopo = coalesce(p_escopo, escopo),
         observacoes = coalesce(p_observacoes, observacoes),
         valido_ate = coalesce(p_valido_ate, valido_ate),
         versao_atual = versao_atual + 1,
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_proposta_id
   returning * into v_proposta;

  insert into comercial.proposta_versoes (proposta_id, versao, payload, criado_por)
  values (
    p_proposta_id,
    v_proposta.versao_atual,
    jsonb_build_object(
      'proposta', to_jsonb(v_proposta),
      'itens', p_itens
    ),
    auth.uid()
  );

  return v_proposta;
end;
$$;

revoke all on function comercial.fn_salvar_composicao_proposta(uuid, jsonb, bigint, bigint, bigint, bigint, text, text, date) from public;
grant execute on function comercial.fn_salvar_composicao_proposta(uuid, jsonb, bigint, bigint, bigint, bigint, text, text, date) to authenticated;

-- ─────────────────────────── AC-7: duplicar proposta terminal ───────────────

create or replace function comercial.fn_duplicar_proposta(p_proposta_id uuid)
returns comercial.propostas
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_origem comercial.propostas%rowtype;
  v_nova comercial.propostas%rowtype;
begin
  perform comercial._fn_guarda_comercial_escrita();

  select * into v_origem from comercial.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposta_id using errcode = 'no_data_found';
  end if;

  insert into comercial.propostas
    (oportunidade_id, tipo, assessment_id, escopo, observacoes,
     custo_total_centavos, piso_centavos, preco_sugerido_centavos, preco_centavos,
     desconto_pct, valido_ate, created_by)
  values
    (v_origem.oportunidade_id, v_origem.tipo, v_origem.assessment_id, v_origem.escopo,
     v_origem.observacoes, v_origem.custo_total_centavos, v_origem.piso_centavos,
     v_origem.preco_sugerido_centavos, v_origem.preco_centavos, v_origem.desconto_pct,
     v_origem.valido_ate, auth.uid())
  returning * into v_nova;

  insert into comercial.proposta_itens
    (proposta_id, tipo, descricao, nivel_id, material_id, quantidade,
     custo_unitario_centavos, total_centavos, created_by)
  select v_nova.id, tipo, descricao, nivel_id, material_id, quantidade,
         custo_unitario_centavos, total_centavos, auth.uid()
    from comercial.proposta_itens
   where proposta_id = p_proposta_id;

  insert into comercial.proposta_versoes (proposta_id, versao, payload, criado_por)
  values (v_nova.id, 1, jsonb_build_object(
    'proposta', to_jsonb(v_nova),
    'duplicadaDe', p_proposta_id
  ), auth.uid());

  return v_nova;
end;
$$;

revoke all on function comercial.fn_duplicar_proposta(uuid) from public;
grant execute on function comercial.fn_duplicar_proposta(uuid) to authenticated;

comment on function comercial.fn_salvar_composicao_proposta(uuid, jsonb, bigint, bigint, bigint, bigint, text, text, date) is
  'AC-3/AC-5: recalcula itens + snapshot em uma operação. Fórmula vem pronta do client '
  '(domain/precificacao.ts) — esta RPC só persiste; trg_propostas_piso continua sendo quem '
  'bloqueia preço abaixo do piso, mesmo dentro desta função.';
