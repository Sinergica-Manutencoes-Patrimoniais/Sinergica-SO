-- ADR-1652: leitura mínima aditiva; sem substituir drawer legado e sem abrir gate.
create table pcm.sso_local_ativo_leitura_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_local_ativo_leitura_gate(id,habilitado) values(true,false);
alter table pcm.sso_local_ativo_leitura_gate enable row level security;
alter table pcm.sso_local_ativo_leitura_gate force row level security;
revoke all on pcm.sso_local_ativo_leitura_gate from public,anon,authenticated,service_role;
create function pcm.sso_local_ativo_leitura_habilitada() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select habilitado from pcm.sso_local_ativo_leitura_gate where id),false);
$$;
revoke all on function pcm.sso_local_ativo_leitura_habilitada() from public,anon,authenticated,service_role;
grant execute on function pcm.sso_local_ativo_leitura_habilitada() to authenticated;

create function pcm.sso_local_ativo_resumo(p_ator uuid,p_cliente uuid,p_local uuid,p_ativo uuid)
returns table(id uuid,nome text,tipo text,identificador text,categoria text,observacoes text)
language plpgsql volatile security invoker set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_local is null or p_ativo is null then
    raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if not pcm.sso_local_ativo_leitura_habilitada() then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.ler',p_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is not true then
    raise exception 'ativo_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select e.id,e.nome,e.tipo,e.identificador,e.categoria,e.observacoes from pcm.equipamentos e
    join pcm.locais l on l.id=e.local_id join pcm.areas a on a.id=l.area_id and a.cliente_id=p_cliente
    where e.id=p_ativo and e.client_id=p_cliente and e.local_id=p_local and e.deleted_at is null and l.deleted_at is null and a.deleted_at is null
      and (config.sso_autorizar_acao('cadastro.ler',p_cliente) is true or config.sso_autorizar_acao('cadastro.gerir',p_cliente) is true);
end;
$$;
revoke all on function pcm.sso_local_ativo_resumo(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_local_ativo_resumo(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_local_ativo_os(p_ator uuid,p_cliente uuid,p_local uuid,p_ativo uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,categoria text,status text,data_agendada timestamptz,created_at timestamptz,direta boolean,auvo boolean)
language plpgsql volatile security invoker set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_local is null or p_ativo is null
    or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if not pcm.sso_local_ativo_leitura_habilitada() then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.ler',p_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is not true then
    raise exception 'ativo_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.equipamentos e join pcm.locais l on l.id=e.local_id join pcm.areas a on a.id=l.area_id and a.cliente_id=p_cliente
    where e.id=p_ativo and e.client_id=p_cliente and e.local_id=p_local and e.deleted_at is null and l.deleted_at is null and a.deleted_at is null) then
    raise exception 'ativo_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select o.id,o.numero,o.categoria,o.status,o.data_agendada,o.created_at,
    coalesce(o.equipamento_id=p_ativo,false),
    exists(select 1 from pcm.os_equipamentos_auvo v join pcm.equipamentos e on e.auvo_equipment_id=v.auvo_equipment_id
      where e.id=p_ativo and e.client_id=p_cliente and e.local_id=p_local and e.deleted_at is null and v.ordem_servico_id=o.id)
    from pcm.ordens_servico o
    join pcm.equipamentos ativo on ativo.id=p_ativo and ativo.client_id=p_cliente and ativo.local_id=p_local and ativo.deleted_at is null
    join pcm.locais local_ativo on local_ativo.id=ativo.local_id and local_ativo.deleted_at is null
    join pcm.areas area_ativo on area_ativo.id=local_ativo.area_id and area_ativo.cliente_id=p_cliente and area_ativo.deleted_at is null
    where o.client_id=p_cliente and o.deleted_at is null and (p_apos is null or o.id>p_apos)
      and (config.sso_autorizar_acao('cadastro.ler',p_cliente) is true or config.sso_autorizar_acao('cadastro.gerir',p_cliente) is true)
      and (o.equipamento_id=p_ativo or exists(select 1 from pcm.os_equipamentos_auvo v join pcm.equipamentos e on e.auvo_equipment_id=v.auvo_equipment_id
        where e.id=p_ativo and e.client_id=p_cliente and e.local_id=p_local and e.deleted_at is null and v.ordem_servico_id=o.id))
    order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_local_ativo_os(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_local_ativo_os(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
