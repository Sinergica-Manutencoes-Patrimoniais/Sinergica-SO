-- ADR-1196: não concede acesso direto às consultas privadas nem abre gates.
create function comercial.sso_historico_legado_os_mediado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid,p_limite integer)
returns table(orcamento_id uuid,numero text,status text,valido_ate date,criado_em timestamptz,decisao_id uuid,decisao text,decisao_em timestamptz,decisao_autor uuid)
language plpgsql volatile security definer set search_path='' as $$
declare v record; anterior uuid:=p_apos; quantidade integer:=0;
begin
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null or p_limite is null or p_limite not between 1 and 99 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_historico_legado_operacional_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'indisponivel' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 for v in select * from comercial.sso_listar_historico_orcamento_legado_os(p_cliente_id,p_os_id,p_apos,p_limite+1) loop
   if v.orcamento_id is null or (anterior is not null and v.orcamento_id<=anterior) then raise exception 'historico_inconsistente' using errcode='23514'; end if;
   anterior:=v.orcamento_id;
   quantidade:=quantidade+1; if quantidade>p_limite then exit; end if;
   return query select v.orcamento_id,v.numero,v.status,v.valido_ate,v.criado_em,v.decisao_id,v.decisao,v.decisao_em,v.decisao_autor;
 end loop;
end; $$;
revoke all on function comercial.sso_historico_legado_os_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_historico_legado_os_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function comercial.sso_historico_legado_pre_os_mediado(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(orcamento_id uuid,requisicao_id uuid,numero text,status text,valido_ate date,criado_em timestamptz,decisao_id uuid,decisao text,decisao_em timestamptz,decisao_autor uuid)
language plpgsql volatile security definer set search_path='' as $$
declare v record; anterior uuid:=p_apos; quantidade integer:=0;
begin
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 99 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_historico_legado_pre_os_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'indisponivel' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 for v in select * from comercial.sso_listar_historico_orcamento_pre_os(p_cliente_id,p_apos,p_limite+1) loop
   if v.orcamento_id is null or (anterior is not null and v.orcamento_id<=anterior) then raise exception 'historico_inconsistente' using errcode='23514'; end if;
   anterior:=v.orcamento_id;
   quantidade:=quantidade+1; if quantidade>p_limite then exit; end if;
   return query select v.orcamento_id,v.requisicao_id,v.numero,v.status,v.valido_ate,v.criado_em,v.decisao_id,v.decisao,v.decisao_em,v.decisao_autor;
 end loop;
end; $$;
revoke all on function comercial.sso_historico_legado_pre_os_mediado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_historico_legado_pre_os_mediado(uuid,uuid,uuid,integer) to authenticated;
