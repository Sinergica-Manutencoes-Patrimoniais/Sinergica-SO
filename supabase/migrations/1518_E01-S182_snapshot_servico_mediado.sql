-- ADR-1371: fotografia interna; não produz candidato, cobrança ou recebível.
create table financeiro.sso_snapshot_servico_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_snapshot_servico_mediado_gate(id,habilitado) values(true,false);
alter table financeiro.sso_snapshot_servico_mediado_gate enable row level security;
alter table financeiro.sso_snapshot_servico_mediado_gate force row level security;
revoke all on financeiro.sso_snapshot_servico_mediado_gate from public,anon,authenticated,service_role;

create function financeiro.sso_consultar_snapshot_servico_mediado(p_cliente_id uuid,p_declaracao_id uuid)
returns table(snapshot_id uuid,decisao_id uuid) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_declaracao_id is null
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or not exists(select 1 from financeiro.sso_servicos_extra_declarados d where d.id=p_declaracao_id and d.cliente_id=p_cliente_id)
 then raise exception 'sem_acesso' using errcode='42501'; end if;
 if exists(select 1 from financeiro.sso_snapshots_servico_extra s join financeiro.sso_servicos_extra_declarados d on d.id=s.declaracao_id
   where s.declaracao_id=p_declaracao_id and (s.cliente_id is distinct from p_cliente_id or s.proposta_id is distinct from d.proposta_id
     or s.versao is distinct from d.versao or s.linha_id is distinct from d.linha_id
     or not exists(select 1 from financeiro.sso_servicos_extra_decisoes x where x.id=s.decisao_id and x.declaracao_id=d.id and x.decisao='aceita')))
 then raise exception 'snapshot_inconsistente' using errcode='23514'; end if;
 return query select s.id,s.decisao_id from financeiro.sso_snapshots_servico_extra s
   where s.declaracao_id=p_declaracao_id and s.cliente_id=p_cliente_id;
end; $$;
revoke all on function financeiro.sso_consultar_snapshot_servico_mediado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_consultar_snapshot_servico_mediado(uuid,uuid) to authenticated;

create function financeiro.sso_registrar_snapshot_servico_mediado(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_decisao uuid; v_resultado jsonb;
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_snapshot_servico_mediado_gate where id and habilitado for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_declaracao_id is null
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select x.id into v_decisao from financeiro.sso_servicos_extra_decisoes x
   join financeiro.sso_servicos_extra_declarados d on d.id=x.declaracao_id
   where d.id=p_declaracao_id and d.cliente_id=p_cliente_id and x.decisao='aceita';
 if v_decisao is null then raise exception 'decisao_nao_disponivel' using errcode='23514'; end if;
 v_resultado:=financeiro.sso_registrar_snapshot_servico_extra(p_request_id,p_cliente_id,p_declaracao_id,v_decisao);
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_registrar_snapshot_servico_mediado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_registrar_snapshot_servico_mediado(uuid,uuid,uuid) to authenticated;
