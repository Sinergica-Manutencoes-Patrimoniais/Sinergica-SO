-- ADR-0716. Gate fechado; revisão de ownership, RLS e testes obrigatória antes de habilitar.
create table financeiro.sso_leituras_faturaveis_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into financeiro.sso_leituras_faturaveis_gate(id, habilitado) values (true, false);
alter table financeiro.sso_leituras_faturaveis_gate enable row level security;
alter table financeiro.sso_leituras_faturaveis_gate force row level security;
revoke all on financeiro.sso_leituras_faturaveis_gate from public, anon, authenticated, service_role;

create function financeiro.sso_consultar_saldo_faturavel(p_cliente_id uuid, p_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_leituras_faturaveis_gate where id), false) then
    raise exception 'indisponivel' using errcode = '55000';
  end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null
    or config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is distinct from true
    or not exists (select 1 from financeiro.itens_faturaveis i where i.id = p_item_id and i.cliente_id = p_cliente_id) then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return financeiro.sso_saldo_unificado_faturavel(p_cliente_id, p_item_id);
end $$;
revoke all on function financeiro.sso_consultar_saldo_faturavel(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function financeiro.sso_consultar_saldo_faturavel(uuid, uuid) to authenticated;

create function financeiro.sso_consultar_lancamentos_faturavel(p_cliente_id uuid, p_item_id uuid, p_apos uuid default null)
returns table(id uuid, descricao text, valor_centavos integer, competencia date, vencimento date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_leituras_faturaveis_gate where id), false) then
    raise exception 'indisponivel' using errcode = '55000';
  end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null
    or config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is distinct from true
    or not exists (select 1 from financeiro.itens_faturaveis i where i.id = p_item_id and i.cliente_id = p_cliente_id) then
    raise exception 'item_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select l.id, l.descricao, l.valor_centavos, l.competencia, l.vencimento
    from financeiro.sso_lancamentos_para_faturavel(p_item_id, p_apos) l;
end $$;
revoke all on function financeiro.sso_consultar_lancamentos_faturavel(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function financeiro.sso_consultar_lancamentos_faturavel(uuid, uuid, uuid) to authenticated;
