-- ADR-0993: leitura exata mediada, gate e concessão fechados.
create table pcm.sso_busca_codigo_mediada_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_busca_codigo_mediada_gate (id, habilitado) values (true, false);
alter table pcm.sso_busca_codigo_mediada_gate enable row level security;
alter table pcm.sso_busca_codigo_mediada_gate force row level security;
revoke all on pcm.sso_busca_codigo_mediada_gate from public, anon, authenticated, service_role;

create function pcm.sso_localizar_codigo_publico_mediada(p_ator_id uuid, p_cliente_id uuid, p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
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
  perform 1 from pcm.sso_busca_codigo_mediada_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'busca_codigo_desabilitada' using errcode = '55000'; end if;
  if p_cliente_id is null or config.sso_autorizar_acao('cadastro.ler', p_cliente_id) is distinct from true then
    raise exception 'codigo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return pcm.sso_localizar_codigo_publico(p_cliente_id, p_codigo);
end;
$$;
revoke all on function pcm.sso_localizar_codigo_publico_mediada(uuid,uuid,text) from public, anon, authenticated, service_role;
revoke all on function pcm.sso_localizar_codigo_publico(uuid,text) from public, anon, authenticated, service_role;
