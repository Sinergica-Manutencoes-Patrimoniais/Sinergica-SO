-- ADR-0164: gate existente fechado, não aplicar ou habilitar isoladamente.
create or replace function pcm.sso_observar_marco_codigo(p_tipo text, p_ativo uuid, p_marco text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_ativo is null or not coalesce((select habilitado from pcm.sso_codigo_marcos_gate where chave), false) then return; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_concorrente_tente_novamente' using errcode = '40001';
  end if;
  if p_marco = 'os' then
    update pcm.sso_codigo_ciclo set referenciado_os_em = now(), revisao = revisao + 1
      where tipo = p_tipo and ativo_id = p_ativo and referenciado_os_em is null;
  elsif p_marco = 'sync' then
    update pcm.sso_codigo_ciclo set sincronizado_em = now(), revisao = revisao + 1
      where tipo = p_tipo and ativo_id = p_ativo and sincronizado_em is null;
  elsif p_marco = 'aprovacao' then
    update pcm.sso_codigo_ciclo set aprovado_em = now(), revisao = revisao + 1
      where tipo = p_tipo and ativo_id = p_ativo and aprovado_em is null;
  else
    raise exception 'marco_desconhecido' using errcode = '22023';
  end if;
end;
$$;
revoke all on function pcm.sso_observar_marco_codigo(text,uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_observar_aprovacao_codigo_levantamento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo='sistema' then perform pcm.sso_observar_marco_codigo('sistema',new.entidade_id,'aprovacao');
  elsif new.tipo in ('equipamento','componente') then perform pcm.sso_observar_marco_codigo('componente',new.entidade_id,'aprovacao'); end if;
  return new;
end;
$$;
revoke all on function pcm.sso_observar_aprovacao_codigo_levantamento() from public,anon,authenticated,service_role;
create trigger sso_codigo_aprovacao_levantamento after insert on pcm.sso_levantamento_incorporacoes
  for each row execute function pcm.sso_observar_aprovacao_codigo_levantamento();
