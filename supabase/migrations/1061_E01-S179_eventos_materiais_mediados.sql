-- ADR-0876: gate fechado; revogação exige rollout coordenado de clientes.
create table pcm.sso_eventos_materiais_mediados_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.sso_eventos_materiais_mediados_gate enable row level security;
alter table pcm.sso_eventos_materiais_mediados_gate force row level security;
revoke all on pcm.sso_eventos_materiais_mediados_gate from public,anon,authenticated,service_role;
insert into pcm.sso_eventos_materiais_mediados_gate(id,habilitado) values (true,false);

create function pcm.sso_informar_material_mediado(p_request_id uuid,p_lista_id uuid,p_expected_revision integer,p_tipo text,p_dados jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_eventos_materiais_mediados_gate g where g.id),false) then
    raise exception 'evento_material_bloqueado' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_eventos_materiais_mediados_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_eventos_materiais_mediados_gate g where g.id),false) then
    raise exception 'evento_material_bloqueado' using errcode='55000';
  end if;
  if auth.uid() is null then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode='42501';
  end if;
  return pcm.sso_informar_material(p_request_id,p_lista_id,p_expected_revision,p_tipo,p_dados);
end;
$$;
revoke all on function pcm.sso_informar_material(uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_informar_material_mediado(uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_informar_material_mediado(uuid,uuid,integer,text,jsonb) to authenticated;
