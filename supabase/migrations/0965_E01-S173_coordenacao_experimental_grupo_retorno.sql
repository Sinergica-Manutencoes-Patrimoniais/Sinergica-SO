-- ADR-0744: experimento fail-closed; não libera consumidores Grupo.
create table pcm.sso_coordenacao_grupo_retorno_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
alter table pcm.sso_coordenacao_grupo_retorno_gate enable row level security;
alter table pcm.sso_coordenacao_grupo_retorno_gate force row level security;
revoke all on pcm.sso_coordenacao_grupo_retorno_gate from public,anon,authenticated,service_role;
insert into pcm.sso_coordenacao_grupo_retorno_gate(id,habilitado) values(true,false);

create function pcm.sso_tentar_coordenar_os_grupo(p_os_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_coordenacao_grupo_retorno_gate where id),false) then return; end if;
 if p_os_id is null then raise exception 'os_indisponivel' using errcode='23514'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-grupo-retorno-os-v1:'||p_os_id::text,0)) then
   raise exception 'origem_os_concorrente_repetir' using errcode='55P03';
 end if;
end; $$;
revoke all on function pcm.sso_tentar_coordenar_os_grupo(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_bloquear_consumidor_visita_nao_integrado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_os_id uuid;
begin
 if tg_table_name='decisoes_validacao_os' then select os_id into v_os_id from pcm.retorno_os_preparado where id=new.retorno_id;
 else v_os_id:=new.os_id; end if;
 if v_os_id is not null then perform pcm.sso_tentar_coordenar_os_grupo(v_os_id); end if;
 if v_os_id is not null and (exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_visita_legado v on v.ocorrencia_legada_id=os.ocorrencia_preventiva_id where os.id=v_os_id and os.client_id=v.cliente_id)
   or exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_os_grupo v on v.os_id=os.id and v.cliente_id=os.client_id where os.id=v_os_id)) then
   raise exception 'origem_consumidores_nao_integrados' using errcode='55000';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_bloquear_consumidor_visita_nao_integrado() from public,anon,authenticated,service_role;

create or replace function pcm.sso_guardar_vinculo_grupo_retorno_preexistente() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_vinculo_os_grupo_gate where id),false) then return new; end if;
 perform pcm.sso_tentar_coordenar_os_grupo(new.os_id);
 if exists(select 1 from pcm.retorno_os_preparado r where r.os_id=new.os_id)
   or exists(select 1 from pcm.sso_pendencias_tecnicas p where p.os_id=new.os_id) then
   raise exception 'os_com_retorno_exige_reconciliacao' using errcode='55000';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_vinculo_grupo_retorno_preexistente() from public,anon,authenticated,service_role;
