-- ADR-0994: consulta de código atual sem habilitação operacional.
create table pcm.sso_codigo_atual_mediado_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_codigo_atual_mediado_gate (id, habilitado) values (true, false);
alter table pcm.sso_codigo_atual_mediado_gate enable row level security;
alter table pcm.sso_codigo_atual_mediado_gate force row level security;
revoke all on pcm.sso_codigo_atual_mediado_gate from public, anon, authenticated, service_role;

create function pcm.sso_consultar_codigo_atual_mediado(
  p_ator_id uuid, p_cliente_id uuid, p_tipo text, p_ativo_id uuid
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_codigo text;
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
  perform 1 from pcm.sso_codigo_atual_mediado_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'codigo_atual_desabilitado' using errcode = '55000'; end if;
  if p_cliente_id is null or p_ativo_id is null or p_tipo is null or p_tipo not in ('sistema','componente') then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('cadastro.ler', p_cliente_id) is distinct from true
     or config.sso_autorizar_acao('codigo.substituir', p_cliente_id) is distinct from true then
    raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_tipo = 'sistema' then
    select s.codigo into v_codigo from pcm.sistemas s
      where s.id = p_ativo_id and s.cliente_id = p_cliente_id and s.deleted_at is null;
  else
    select e.identificador into v_codigo from pcm.equipamentos e
      where e.id = p_ativo_id and e.client_id = p_cliente_id and e.deleted_at is null;
  end if;
  if v_codigo is null or pg_catalog.length(pg_catalog.btrim(v_codigo)) = 0 or pg_catalog.length(v_codigo) > 200 then
    raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object('tipo', p_tipo, 'ativoId', p_ativo_id, 'codigo', v_codigo);
end;
$$;
revoke all on function pcm.sso_consultar_codigo_atual_mediado(uuid,uuid,text,uuid) from public, anon, authenticated, service_role;
