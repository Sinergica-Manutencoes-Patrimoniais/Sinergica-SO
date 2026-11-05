-- ADR-0401. Contador interno, sem liberação de acesso ou envio.
alter table pcm.visita_composicao_conferencia_gate add column epoca uuid not null default gen_random_uuid();
create function pcm.sso_renovar_epoca_composicao()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.habilitado is distinct from old.habilitado then new.epoca:=gen_random_uuid(); end if;
  return new;
end $$;
revoke all on function pcm.sso_renovar_epoca_composicao() from public,anon,authenticated,service_role;
create trigger sso_epoca_composicao before update on pcm.visita_composicao_conferencia_gate for each row execute function pcm.sso_renovar_epoca_composicao();
create table pcm.visita_composicao_geracoes (
  visita_id uuid primary key references pcm.visitas(id),
  geracao bigint not null default 0 check (geracao >= 0)
);
alter table pcm.visita_composicao_geracoes enable row level security;
alter table pcm.visita_composicao_geracoes force row level security;
revoke all on pcm.visita_composicao_geracoes from public,anon,authenticated,service_role;

create function pcm.sso_incrementar_geracao_composicao(p_visita_id uuid)
returns void language sql security definer set search_path='' as $$
  insert into pcm.visita_composicao_geracoes(visita_id,geracao) values(p_visita_id,1)
  on conflict (visita_id) do update set geracao=pcm.visita_composicao_geracoes.geracao+1
$$;
revoke all on function pcm.sso_incrementar_geracao_composicao(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_mudanca_vinculo_composicao()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='UPDATE' and new is not distinct from old then return new; end if;
  if tg_op<>'INSERT' then perform pcm.sso_incrementar_geracao_composicao(old.visita_id); end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.visita_id is distinct from old.visita_id) then
    perform pcm.sso_incrementar_geracao_composicao(new.visita_id);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function pcm.sso_mudanca_vinculo_composicao() from public,anon,authenticated,service_role;
create trigger sso_geracao_visita_os after insert or update or delete on pcm.visita_ordens_servico for each row execute function pcm.sso_mudanca_vinculo_composicao();
create trigger sso_geracao_visita_equipe after insert or update or delete on pcm.visita_equipes for each row execute function pcm.sso_mudanca_vinculo_composicao();

create function pcm.sso_mudanca_os_composicao()
returns trigger language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then return new; end if;
  if new.status is not distinct from old.status and new.deleted_at is not distinct from old.deleted_at then return new; end if;
  for v in select distinct visita_id from pcm.visita_ordens_servico where os_id=new.id and encerrado_em is null order by visita_id loop
    perform pcm.sso_incrementar_geracao_composicao(v);
  end loop;
  return new;
end $$;
revoke all on function pcm.sso_mudanca_os_composicao() from public,anon,authenticated,service_role;
create trigger sso_geracao_composicao_os after update on pcm.ordens_servico for each row execute function pcm.sso_mudanca_os_composicao();

create function pcm.sso_mudanca_funcionario_composicao()
returns trigger language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then return new; end if;
  if new.ativo is not distinct from old.ativo and new.deleted_at is not distinct from old.deleted_at then return new; end if;
  for v in select distinct visita_id from pcm.visita_equipes where funcionario_id=new.id and encerrado_em is null order by visita_id loop
    perform pcm.sso_incrementar_geracao_composicao(v);
  end loop;
  return new;
end $$;
revoke all on function pcm.sso_mudanca_funcionario_composicao() from public,anon,authenticated,service_role;
create trigger sso_geracao_composicao_funcionario after update on pcm.funcionarios for each row execute function pcm.sso_mudanca_funcionario_composicao();

alter function pcm.sso_snapshot_composicao_visita(uuid,uuid) rename to sso_snapshot_composicao_visita_basico;
create function pcm.sso_snapshot_composicao_visita(p_visita_id uuid,p_cliente_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select pcm.sso_snapshot_composicao_visita_basico(p_visita_id,p_cliente_id) ||
    jsonb_build_object('geracao',coalesce((select geracao from pcm.visita_composicao_geracoes where visita_id=p_visita_id),0)::text,
      'epoca',(select epoca from pcm.visita_composicao_conferencia_gate where id)::text)
$$;
revoke all on function pcm.sso_snapshot_composicao_visita_basico(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_snapshot_composicao_visita(uuid,uuid) from public,anon,authenticated,service_role;
