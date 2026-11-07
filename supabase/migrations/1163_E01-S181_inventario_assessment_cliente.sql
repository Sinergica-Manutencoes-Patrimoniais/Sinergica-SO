-- ADR-1012: contagens agregadas, acesso fechado.
create table comercial.sso_inventario_assessment_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_inventario_assessment_gate(id,habilitado) values(true,false);
alter table comercial.sso_inventario_assessment_gate enable row level security;
alter table comercial.sso_inventario_assessment_gate force row level security;
revoke all on comercial.sso_inventario_assessment_gate from public,anon,authenticated,service_role;
create function comercial.sso_inventariar_assessment_cliente(p_ator_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_total bigint; v_divergentes bigint; v_arquivados bigint;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_inventario_assessment_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'inventario_desabilitado' using errcode='55000'; end if;
  if not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin' and auth.jwt()->>'user_role'='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*), count(*) filter(where i.client_id is distinct from o.cliente_id), count(*) filter(where i.deleted_at is not null)
    into v_total,v_divergentes,v_arquivados
    from comercial.propostas p join comercial.oportunidades o on o.id=p.oportunidade_id join pcm.inspecoes i on i.id=p.assessment_id
    where p.assessment_id is not null;
  return pg_catalog.jsonb_build_object('vinculos',v_total,'clientesDivergentes',v_divergentes,'inspecoesArquivadas',v_arquivados);
end;
$$;
revoke all on function comercial.sso_inventariar_assessment_cliente(uuid) from public,anon,authenticated,service_role;
