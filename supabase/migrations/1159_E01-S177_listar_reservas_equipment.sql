-- ADR-1007: leitura privada de reservas, sem inferir efeito remoto.
create table pcm.sso_consulta_reserva_equipment_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_consulta_reserva_equipment_gate(id,habilitado) values(true,false);
alter table pcm.sso_consulta_reserva_equipment_gate enable row level security;
alter table pcm.sso_consulta_reserva_equipment_gate force row level security;
revoke all on pcm.sso_consulta_reserva_equipment_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_reservas_equipment(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(outbox_id uuid,componente_id uuid,nome text,status_local text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_consulta_reserva_equipment_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'consulta_reserva_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select r.outbox_id,e.id,e.nome,o.status,r.criado_em
    from pcm.sso_reserva_equipment_outbox r join pcm.equipamentos e on e.id=r.componente_id
    join pcm.auvo_sync_outbox o on o.id=r.outbox_id and o.entity='equipamentos' and o.row_id=e.id
    where e.client_id=p_cliente_id and (p_apos is null or r.outbox_id>p_apos)
    order by r.outbox_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_reservas_equipment(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
