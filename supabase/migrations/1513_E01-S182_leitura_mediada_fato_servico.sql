-- ADR-1366: não concede EXECUTE no núcleo privado e não cria fato faturável.
create table financeiro.sso_leitura_fato_servico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_leitura_fato_servico_gate(id,habilitado) values(true,false);
alter table financeiro.sso_leitura_fato_servico_gate enable row level security;
alter table financeiro.sso_leitura_fato_servico_gate force row level security;
revoke all on financeiro.sso_leitura_fato_servico_gate from public,anon,authenticated,service_role;

create function financeiro.sso_consultar_fato_execucao_mediado(p_cliente_id uuid,p_declaracao_id uuid)
returns table(fato_id uuid) language plpgsql volatile security definer set search_path='' as $$
declare v_fatos uuid[];
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_declaracao_id is null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select pg_catalog.array_agg(q.fato_id) into v_fatos from (
    select f.fato_id from financeiro.sso_consultar_fato_execucao_declarado(p_cliente_id,p_declaracao_id) f limit 2
  ) q;
  if coalesce(pg_catalog.array_length(v_fatos,1),0)>1 then raise exception 'fato_ambiguo' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select x from pg_catalog.unnest(coalesce(v_fatos,array[]::uuid[])) x;
end; $$;
revoke all on function financeiro.sso_consultar_fato_execucao_mediado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_consultar_fato_execucao_mediado(uuid,uuid) to authenticated;
