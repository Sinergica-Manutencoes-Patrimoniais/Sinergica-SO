-- ADR-1041: leitura auditável e limitada, sem inferir capacidade operacional.
create table pcm.sso_historico_alertas_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_alertas_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_alertas_visita_gate enable row level security;
alter table pcm.sso_historico_alertas_visita_gate force row level security;
revoke all on pcm.sso_historico_alertas_visita_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_alertas_reprogramacao(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,vencimento_declarado date,alertas jsonb,motivo text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_visita_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_historico_alertas_visita_gate where id and habilitado for share;
  if not found then raise exception 'historico_alertas_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.visitas v where v.id=p_visita_id and v.cliente_id=p_cliente_id for share;
  if not found then raise exception 'visita_indisponivel' using errcode='42501'; end if;
  return query select c.request_id,c.ator_id,(c.payload->>'vencimentoDeclarado')::date,c.payload->'alertas',c.payload->>'motivo',c.criado_em
    from pcm.sso_alertas_reprogramacao_comandos c where c.cliente_id=p_cliente_id and c.visita_id=p_visita_id
      and (p_apos is null or c.request_id>p_apos) order by c.request_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_alertas_reprogramacao(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
