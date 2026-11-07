-- ADR-0874: gate fechado; revogação do núcleo exige rollout coordenado de clientes.
create table pcm.sso_criacao_materiais_mediada_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.sso_criacao_materiais_mediada_gate enable row level security;
alter table pcm.sso_criacao_materiais_mediada_gate force row level security;
revoke all on pcm.sso_criacao_materiais_mediada_gate from public,anon,authenticated,service_role;
insert into pcm.sso_criacao_materiais_mediada_gate(id,habilitado) values (true,false);

create function pcm.sso_registrar_lista_materiais_mediada(
  p_request_id uuid,p_expected_revision integer,p_lista_id uuid,p_ordem_servico_id uuid,
  p_responsavel text,p_texto_original text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_criacao_materiais_mediada_gate g where g.id),false) then
    raise exception 'criacao_materiais_bloqueada' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_criacao_materiais_mediada_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_criacao_materiais_mediada_gate g where g.id),false) then
    raise exception 'criacao_materiais_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode='42501';
  end if;
  return pcm.sso_registrar_lista_materiais(p_request_id,p_expected_revision,p_lista_id,p_ordem_servico_id,p_responsavel,p_texto_original);
end;
$$;
revoke all on function pcm.sso_registrar_lista_materiais(uuid,integer,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_registrar_lista_materiais_mediada(uuid,integer,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_lista_materiais_mediada(uuid,integer,uuid,uuid,text,text) to authenticated;
