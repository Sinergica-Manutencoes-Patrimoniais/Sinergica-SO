-- ADR-0873: leitura mediada; não abrir gate nesta migration.
create table pcm.sso_central_materiais_mediada_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.sso_central_materiais_mediada_gate enable row level security;
alter table pcm.sso_central_materiais_mediada_gate force row level security;
revoke all on pcm.sso_central_materiais_mediada_gate from public,anon,authenticated,service_role;
insert into pcm.sso_central_materiais_mediada_gate(id,habilitado) values (true,false);

create function pcm.sso_consultar_central_materiais_mediada(
  p_cliente_id uuid,p_ordem_servico_id uuid,p_responsavel text,p_limite integer,p_apos uuid
) returns table(id uuid,ordem_servico_id uuid,responsavel text,texto_original text,estado text,revisao integer)
language plpgsql volatile security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_central_materiais_mediada_gate g where g.id),false) then
    raise exception 'central_materiais_bloqueada' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_central_materiais_mediada_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_central_materiais_mediada_gate g where g.id),false) then
    raise exception 'central_materiais_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501';
  end if;
  return query select * from pcm.sso_consultar_central_materiais(p_cliente_id,p_ordem_servico_id,p_responsavel,p_limite,p_apos);
end;
$$;
revoke all on function pcm.sso_consultar_central_materiais_mediada(uuid,uuid,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_central_materiais_mediada(uuid,uuid,text,integer,uuid) to authenticated;
