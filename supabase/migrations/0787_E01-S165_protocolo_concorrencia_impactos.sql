-- ADR-0562: protocolo opt-in, não bloqueante; aplicação exige janela de manutenção.
create table pcm.sso_concorrencia_impacto_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_concorrencia_impacto_gate enable row level security;alter table pcm.sso_concorrencia_impacto_gate force row level security;
revoke all on pcm.sso_concorrencia_impacto_gate from public,anon,authenticated,service_role;
insert into pcm.sso_concorrencia_impacto_gate(id,habilitado) values(true,false);

create function pcm.sso_guardar_escrita_impacto_global() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((select habilitado from pcm.sso_concorrencia_impacto_gate where id),false) and not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03';end if;
 return null;
end; $$;
revoke all on function pcm.sso_guardar_escrita_impacto_global() from public,anon,authenticated,service_role;
create trigger sso_guardar_impacto_os before insert or update or delete on pcm.ordens_servico for each statement execute function pcm.sso_guardar_escrita_impacto_global();
create trigger sso_guardar_impacto_ocorrencia_preparada before insert or update or delete on pcm.ocorrencias_rotina_preparadas for each statement execute function pcm.sso_guardar_escrita_impacto_global();
create trigger sso_guardar_impacto_ocorrencia_visita before insert or update or delete on pcm.ocorrencias_visita_preparadas for each statement execute function pcm.sso_guardar_escrita_impacto_global();
create trigger sso_guardar_impacto_ocorrencia_legada before insert or update or delete on pcm.ocorrencias_preventivas for each statement execute function pcm.sso_guardar_escrita_impacto_global();
create trigger sso_guardar_impacto_ponte_calendario before insert or update or delete on pcm.ocorrencias_rotina_vinculos for each statement execute function pcm.sso_guardar_escrita_impacto_global();
create trigger sso_guardar_impacto_ponte_visita before insert or update or delete on pcm.sso_vinculos_visita_legado for each statement execute function pcm.sso_guardar_escrita_impacto_global();
