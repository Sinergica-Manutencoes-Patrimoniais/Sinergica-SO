-- ADR-0203: com gate false mantém as alterações legadas existentes.
create function financeiro.sso_proteger_lancamento_faturavel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from financeiro.sso_faturamento_gate g where g.id), false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if exists (select 1 from financeiro.sso_faturavel_documentos d
    join financeiro.sso_faturavel_alocacoes a on a.documento_id = d.id where d.lancamento_id = old.id)
    or exists (select 1 from financeiro.sso_faturavel_conferencias_estorno c where c.lancamento_saida_id = old.id) then
    if tg_op = 'DELETE' then raise exception 'lancamento_faturavel_exige_fluxo_coordenado' using errcode = '23514'; end if;
    if new.tipo is distinct from old.tipo or new.cliente_id is distinct from old.cliente_id
      or new.os_id is distinct from old.os_id or new.data_competencia is distinct from old.data_competencia
      or new.valor_centavos is distinct from old.valor_centavos or new.origem is distinct from old.origem
      or new.categoria_id is distinct from old.categoria_id or new.conta_id is distinct from old.conta_id
      or new.data_vencimento is distinct from old.data_vencimento
      or (old.status = 'realizado' and (new.status is distinct from old.status or new.data_pagamento is distinct from old.data_pagamento)) then
      raise exception 'lancamento_faturavel_exige_fluxo_coordenado' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function financeiro.sso_proteger_lancamento_faturavel() from public, anon, authenticated, service_role;
create trigger s182_proteger_lancamento_faturavel before update or delete on financeiro.lancamentos
  for each row execute function financeiro.sso_proteger_lancamento_faturavel();

create function financeiro.sso_historico_documentos_faturavel(p_item_id uuid, p_apos uuid default null)
returns table(alocacao_id uuid, documento_ref text, data_documento date, valor_centavos bigint,
  lancamento_id uuid, lancamento_status text, data_pagamento date, estorno_id uuid,
  conferencia_id uuid, data_conferencia timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if auth.uid() is null or p_item_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  select cliente_id into v_cliente from financeiro.itens_faturaveis i where i.id = p_item_id;
  if v_cliente is null or config.sso_autorizar_acao('faturavel.efetivar', v_cliente) is not true then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from financeiro.sso_faturamento_gate g where g.id), false) then
    raise exception 'faturamento_indisponivel' using errcode = '55000'; end if;
  return query select a.id, d.referencia, d.data_documento, a.valor_centavos, l.id, l.status, l.data_pagamento,
    e.id, c.id, c.criado_em
    from financeiro.sso_faturavel_alocacoes a
    join financeiro.sso_faturavel_documentos d on d.id = a.documento_id and d.cliente_id = v_cliente
    join financeiro.lancamentos l on l.id = d.lancamento_id and l.cliente_id = v_cliente
    left join financeiro.sso_faturavel_estornos e on e.alocacao_id = a.id and e.item_id = p_item_id
    left join financeiro.sso_faturavel_conferencias_estorno c on c.estorno_id = e.id
    where a.item_id = p_item_id and (p_apos is null or a.id > p_apos) order by a.id limit 20;
end;
$$;
revoke all on function financeiro.sso_historico_documentos_faturavel(uuid, uuid) from public, anon, authenticated, service_role;
