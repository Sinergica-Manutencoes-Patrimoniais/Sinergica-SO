-- ADR-0547: não remover chaves de Grupo silenciosamente.
create table pcm.sso_preservar_caracteristicas_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_preservar_caracteristicas_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_preservar_caracteristicas_grupo_gate enable row level security;alter table pcm.sso_preservar_caracteristicas_grupo_gate force row level security;
revoke all on pcm.sso_preservar_caracteristicas_grupo_gate from public,anon,authenticated,service_role;
create function pcm.sso_guardar_caracteristicas_grupo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_preservar_caracteristicas_grupo_gate where id),false) then return new; end if;
 if old.caracteristicas is distinct from new.caracteristicas then
   if jsonb_typeof(old.caracteristicas) is distinct from 'object' or jsonb_typeof(new.caracteristicas) is distinct from 'object' then raise exception 'caracteristicas_nao_reconciliadas' using errcode='23514'; end if;
   if exists(select 1 from jsonb_object_keys(old.caracteristicas) k(chave) where not (new.caracteristicas ? k.chave)) then raise exception 'remocao_caracteristica_nao_autorizada' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_caracteristicas_grupo() from public,anon,authenticated,service_role;
create trigger sso_guardar_caracteristicas_grupo before update of caracteristicas on pcm.grupos_quantitativos for each row execute function pcm.sso_guardar_caracteristicas_grupo();
