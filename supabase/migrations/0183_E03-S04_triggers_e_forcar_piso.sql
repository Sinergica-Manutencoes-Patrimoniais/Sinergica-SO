-- 0183_E03-S04_triggers_e_forcar_piso.sql — Sinérgica SO
-- Story E03-S04. Trigger de piso (AC-4), trigger de transição de status (AC-6) e a RPC de
-- exceção que permite superadmin forçar preço abaixo do piso com auditoria (AC-4).
--
-- Rollback:
--   drop function if exists comercial.fn_forcar_preco_abaixo_piso(uuid, bigint, text);
--   drop trigger if exists trg_propostas_transicao_status on comercial.propostas;
--   drop function if exists comercial.fn_proposta_transicao_status();
--   drop trigger if exists trg_propostas_piso on comercial.propostas;
--   drop function if exists comercial.fn_proposta_valida_piso();

-- ─────────────────────────── AC-4: piso no banco ────────────────────────────

create or replace function comercial.fn_proposta_valida_piso()
returns trigger
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
begin
  if new.preco_centavos < new.piso_centavos then
    -- Flag ligada só pela RPC fn_forcar_preco_abaixo_piso, local à transação dela — UPDATE/INSERT
    -- direto (mesmo de superadmin) nunca tem a flag ligada, então nunca passa aqui.
    if coalesce(current_setting('comercial.forcar_piso', true), 'false') <> 'true' then
      raise exception 'Preço (%) abaixo do piso (%) — use a exceção autorizada para forçar.',
        new.preco_centavos, new.piso_centavos
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_propostas_piso
  before insert or update on comercial.propostas
  for each row
  execute function comercial.fn_proposta_valida_piso();

-- ─────────────────────────── AC-6: transição de status ──────────────────────

create or replace function comercial.fn_proposta_transicao_status()
returns trigger
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_permitidas text[];
begin
  if tg_op = 'INSERT' or old.status = new.status then
    return new;
  end if;

  v_permitidas := case old.status
    when 'rascunho'    then array['em_revisao', 'cancelada']
    when 'em_revisao'  then array['rascunho', 'aprovada', 'cancelada']
    when 'aprovada'    then array['enviada', 'cancelada']
    when 'enviada'     then array['aceita', 'recusada', 'cancelada']
    -- aceita/recusada/cancelada são terminais — sem transição de volta (AC-7: imutável).
    else array[]::text[]
  end;

  if not (new.status = any (v_permitidas)) then
    raise exception 'Transição de status inválida: % → %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_propostas_transicao_status
  before update on comercial.propostas
  for each row
  execute function comercial.fn_proposta_transicao_status();

-- ─────────────────────────── AC-4: exceção autorizada ───────────────────────

create or replace function comercial.fn_forcar_preco_abaixo_piso(
  p_proposta_id uuid,
  p_preco_centavos bigint,
  p_motivo text default null
)
returns comercial.propostas
language plpgsql
security definer
set search_path = comercial, pg_temp
as $$
declare
  v_proposta comercial.propostas%rowtype;
begin
  if coalesce((auth.jwt() ->> 'user_role') = 'superadmin', false) is not true then
    raise exception 'Apenas superadmin pode forçar preço abaixo do piso' using errcode = '42501';
  end if;

  select * into v_proposta from comercial.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposta_id using errcode = 'no_data_found';
  end if;

  -- Liga a flag só para esta transação (`true` no 3º argumento de set_config = local/LOCAL) —
  -- o trigger vê a flag, deixa passar; ao fim da transação a flag desliga sozinha.
  perform set_config('comercial.forcar_piso', 'true', true);

  update comercial.propostas
     set preco_centavos = p_preco_centavos,
         -- Desconto em relação ao preço SUGERIDO (referência fixa), não ao piso — consistente com
         -- o resto do fluxo (fn_calcular_composicao_proposta, próxima migration).
         desconto_pct = case when v_proposta.preco_sugerido_centavos > 0
           then round((1 - (p_preco_centavos::numeric / v_proposta.preco_sugerido_centavos)) * 100, 3)
           else 0 end,
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_proposta_id
   returning * into v_proposta;

  insert into comercial.proposta_forcos_piso
    (proposta_id, preco_centavos, piso_centavos, autorizado_por, motivo)
  values
    (p_proposta_id, p_preco_centavos, v_proposta.piso_centavos, auth.uid(), p_motivo);

  return v_proposta;
end;
$$;

revoke all on function comercial.fn_forcar_preco_abaixo_piso(uuid, bigint, text) from public;
grant execute on function comercial.fn_forcar_preco_abaixo_piso(uuid, bigint, text) to authenticated;

comment on function comercial.fn_forcar_preco_abaixo_piso(uuid, bigint, text) is
  'AC-4: único caminho pra gravar preco_centavos < piso_centavos. Guarda de superadmin no banco '
  '(não só na UI); grava evento em proposta_forcos_piso antes de retornar.';
