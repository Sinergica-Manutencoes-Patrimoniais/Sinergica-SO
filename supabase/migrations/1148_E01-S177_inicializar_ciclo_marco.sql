-- ADR-0995: ciclo nasce apenas ao observar evento, sem inferir histórico.
create or replace function pcm.sso_observar_marco_codigo(p_tipo text, p_ativo uuid, p_marco text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_ativo is null or not coalesce((select habilitado from pcm.sso_codigo_marcos_gate where chave), false) then return; end if;
  if p_tipo is null or p_tipo not in ('sistema', 'componente') or p_marco is null or p_marco not in ('os', 'sync', 'aprovacao') then
    raise exception 'marco_desconhecido' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_concorrente_tente_novamente' using errcode = '40001';
  end if;
  if p_tipo = 'sistema' then
    select s.cliente_id into v_cliente from pcm.sistemas s where s.id = p_ativo;
  else
    select e.client_id into v_cliente from pcm.equipamentos e where e.id = p_ativo;
  end if;
  if v_cliente is null then raise exception 'ativo_codigo_indisponivel' using errcode = '23514'; end if;
  insert into pcm.sso_codigo_ciclo(tipo, ativo_id, cliente_id)
    values (p_tipo, p_ativo, v_cliente) on conflict (tipo, ativo_id) do nothing;
  if not exists (select 1 from pcm.sso_codigo_ciclo c
    where c.tipo = p_tipo and c.ativo_id = p_ativo and c.cliente_id = v_cliente) then
    raise exception 'ciclo_codigo_cliente_divergente' using errcode = '23514';
  end if;
  if p_marco = 'os' then
    update pcm.sso_codigo_ciclo set referenciado_os_em = now(), revisao = revisao + 1
      where tipo = p_tipo and ativo_id = p_ativo and referenciado_os_em is null;
  elsif p_marco = 'sync' then
    update pcm.sso_codigo_ciclo set sincronizado_em = now(), revisao = revisao + 1
      where tipo = p_tipo and ativo_id = p_ativo and sincronizado_em is null;
  else
    update pcm.sso_codigo_ciclo set aprovado_em = now(), revisao = revisao + 1
      where tipo = p_tipo and ativo_id = p_ativo and aprovado_em is null;
  end if;
end;
$$;
revoke all on function pcm.sso_observar_marco_codigo(text,uuid,text) from public, anon, authenticated, service_role;
