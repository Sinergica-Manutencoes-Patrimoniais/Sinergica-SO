-- ADR-0511: token transacional privado; gate desligado preserva caminho anterior.
create table pcm.sso_guarda_ciclo_canonico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_guarda_ciclo_canonico_gate enable row level security;alter table pcm.sso_guarda_ciclo_canonico_gate force row level security;
revoke all on pcm.sso_guarda_ciclo_canonico_gate from public,anon,authenticated,service_role;
insert into pcm.sso_guarda_ciclo_canonico_gate(id,habilitado) values(true,false);
create table pcm.sso_materializacao_canonica_tokens(txid bigint not null,plano_id uuid not null,versao_id uuid not null,rotina_id uuid not null,vencimento date not null,primary key(txid,plano_id,versao_id,rotina_id,vencimento));
alter table pcm.sso_materializacao_canonica_tokens enable row level security;alter table pcm.sso_materializacao_canonica_tokens force row level security;
revoke all on pcm.sso_materializacao_canonica_tokens from public,anon,authenticated,service_role;

create function pcm.sso_guardar_materializacao_canonica() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_guarda_ciclo_canonico_gate where id),false) then return new;end if;
 if not coalesce((select habilitado from pcm.sso_materializar_ciclo_canonico_gate where id),false) or not exists(select 1 from pcm.sso_materializacao_canonica_tokens t where t.txid=pg_catalog.txid_current() and t.plano_id=new.plano_id and t.versao_id=new.versao_id and t.rotina_id=new.rotina_id and t.vencimento=new.vencimento_original) then raise exception 'materializacao_exige_ciclo_canonico' using errcode='23514';end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_materializacao_canonica() from public,anon,authenticated,service_role;
create trigger sso_guardar_materializacao_canonica before insert on pcm.ocorrencias_rotina_preparadas for each row execute function pcm.sso_guardar_materializacao_canonica();
