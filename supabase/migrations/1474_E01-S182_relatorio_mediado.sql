-- ADR-1324: mediação de leitura; núcleo e gates financeiros continuam privados.
create table financeiro.sso_relatorio_despesas_mediado_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into financeiro.sso_relatorio_despesas_mediado_gate(id, habilitado) values (true, false);
alter table financeiro.sso_relatorio_despesas_mediado_gate enable row level security;
alter table financeiro.sso_relatorio_despesas_mediado_gate force row level security;
revoke all on financeiro.sso_relatorio_despesas_mediado_gate from public, anon, authenticated, service_role;

create function financeiro.sso_relatorio_despesas_faturaveis_mediado(
  p_ator_esperado uuid, p_cliente_id uuid, p_inicio date, p_fim date
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from financeiro.sso_relatorio_despesas_mediado_gate where id and habilitado for share;
  if not found then raise exception 'relatorio_bloqueado' using errcode = '55000'; end if;
  perform 1 from pcm.sso_resumo_despesa_gate where id and habilitado for share;
  if not found then raise exception 'relatorio_bloqueado' using errcode = '55000'; end if;
  perform 1 from financeiro.sso_faturamento_gate where id and habilitado for share;
  if not found then raise exception 'relatorio_bloqueado' using errcode = '55000'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado or p_cliente_id is null or
     config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is distinct from true or
     config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  perform 1 from pcm.clientes where id = p_cliente_id for share;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is distinct from true or
     config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return financeiro.sso_relatorio_despesas_faturaveis(p_cliente_id, p_inicio, p_fim);
end $$;
revoke all on function financeiro.sso_relatorio_despesas_faturaveis_mediado(uuid,uuid,date,date)
  from public, anon, authenticated, service_role;
grant execute on function financeiro.sso_relatorio_despesas_faturaveis_mediado(uuid,uuid,date,date) to authenticated;
