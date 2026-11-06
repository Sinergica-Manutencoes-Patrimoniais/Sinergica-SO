-- ADR-1202: guarda parcial; gate fechado por padrão.
create table pcm.sso_impedimento_material_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_impedimento_material_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_impedimento_material_visita_gate enable row level security;
alter table pcm.sso_impedimento_material_visita_gate force row level security;
revoke all on pcm.sso_impedimento_material_visita_gate from public,anon,authenticated,service_role;
create function pcm.sso_guardar_material_confirmacao_visita()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_ativo boolean;v_os uuid;v_estado text;
begin
 if new.estado is distinct from 'confirmada' or old.estado is not distinct from new.estado then return new; end if;
 select g.habilitado into v_ativo from pcm.sso_impedimento_material_visita_gate g where g.id for share;
 if not found then raise exception 'gate_indisponivel' using errcode='55000'; end if;
 if not v_ativo then return new; end if;
 for v_os in select distinct v.os_id from pcm.visita_ordens_servico v where v.visita_id=new.id and v.cliente_id=new.cliente_id and v.encerrado_em is null order by v.os_id loop
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-os:'||v_os::text,0)) then raise exception 'os_em_alteracao' using errcode='55P03'; end if;
  select e.estado into v_estado from pcm.sso_impedimento_material_os_eventos e where e.os_id=v_os order by e.revisao desc limit 1;
  if v_estado='suspenso' then raise exception 'visita_com_impedimento_material' using errcode='23514'; end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_material_confirmacao_visita() from public,anon,authenticated,service_role;
create trigger sso_guardar_material_confirmacao_visita before update of estado on pcm.visitas
 for each row execute function pcm.sso_guardar_material_confirmacao_visita();
