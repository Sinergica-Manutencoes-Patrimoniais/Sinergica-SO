-- ADR-0140: gate desligado. Não habilitar sem integração completa e validação.
create table pcm.sso_codigo_marcos_gate (
  chave boolean primary key default true check (chave),
  habilitado boolean not null default false
);
insert into pcm.sso_codigo_marcos_gate(chave, habilitado) values (true, false);
alter table pcm.sso_codigo_marcos_gate enable row level security;
alter table pcm.sso_codigo_marcos_gate force row level security;
revoke all on pcm.sso_codigo_marcos_gate from public, anon, authenticated, service_role;

create function pcm.sso_observar_marco_codigo(p_tipo text, p_ativo uuid, p_marco text)
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
  else
    raise exception 'marco_desconhecido' using errcode = '22023';
  end if;
end;
$$;
revoke all on function pcm.sso_observar_marco_codigo(text,uuid,text) from public, anon, authenticated, service_role;

create function pcm.sso_observar_codigo_os() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pcm.sso_observar_marco_codigo('sistema', new.sistema_id, 'os');
  perform pcm.sso_observar_marco_codigo('componente', new.equipamento_id, 'os');
  return new;
end;
$$;
revoke all on function pcm.sso_observar_codigo_os() from public, anon, authenticated, service_role;
create trigger sso_observar_codigo_os after insert or update of sistema_id, equipamento_id on pcm.ordens_servico
  for each row execute function pcm.sso_observar_codigo_os();

create function pcm.sso_observar_codigo_sync() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.auvo_id is not null or new.auvo_equipment_id is not null then
    perform pcm.sso_observar_marco_codigo(case when tg_table_name = 'sistemas' then 'sistema' else 'componente' end, new.id, 'sync');
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_observar_codigo_sync() from public, anon, authenticated, service_role;
create trigger sso_observar_codigo_sistema_sync after insert or update of auvo_id, auvo_equipment_id on pcm.sistemas
  for each row execute function pcm.sso_observar_codigo_sync();
create trigger sso_observar_codigo_equipamento_sync after insert or update of auvo_id, auvo_equipment_id on pcm.equipamentos
  for each row execute function pcm.sso_observar_codigo_sync();
