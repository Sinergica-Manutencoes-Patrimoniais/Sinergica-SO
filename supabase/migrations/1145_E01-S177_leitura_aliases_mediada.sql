-- ADR-0992: leitura protegida, sem concessão operacional nesta etapa.
create table pcm.sso_leitura_aliases_mediada_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_leitura_aliases_mediada_gate (id, habilitado) values (true, false);
alter table pcm.sso_leitura_aliases_mediada_gate enable row level security;
alter table pcm.sso_leitura_aliases_mediada_gate force row level security;
revoke all on pcm.sso_leitura_aliases_mediada_gate from public, anon, authenticated, service_role;

create function pcm.sso_listar_aliases_ativo_mediada(
  p_ator_id uuid, p_cliente_id uuid, p_tipo text, p_ativo_id uuid, p_apos uuid, p_limite integer
) returns table(id uuid, codigo text, criado_em timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then
    raise exception 'sessao_invalida' using errcode = '42501';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_leitura_aliases_mediada_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'leitura_aliases_desabilitada' using errcode = '55000'; end if;
  perform 1 from pcm.sso_listagem_aliases_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'listagem_desabilitada' using errcode = '55000'; end if;
  if p_cliente_id is null or config.sso_autorizar_acao('cadastro.ler', p_cliente_id) is distinct from true then
    raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select a.id, a.codigo, a.criado_em
    from pcm.sso_listar_aliases_ativo(p_cliente_id, p_tipo, p_ativo_id, p_apos, p_limite) a;
end;
$$;
revoke all on function pcm.sso_listar_aliases_ativo_mediada(uuid,uuid,text,uuid,uuid,integer) from public, anon, authenticated, service_role;
revoke all on function pcm.sso_listar_aliases_ativo(uuid,text,uuid,uuid,integer) from public, anon, authenticated, service_role;
