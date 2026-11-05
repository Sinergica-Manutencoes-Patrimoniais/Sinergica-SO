-- ADR-0601: proteção opt-in da identidade da OS com vínculo declarado de Grupo.
create table pcm.sso_guardar_os_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_guardar_os_grupo_gate enable row level security;
alter table pcm.sso_guardar_os_grupo_gate force row level security;
revoke all on pcm.sso_guardar_os_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_guardar_os_grupo_gate(id,habilitado) values(true,false);
create function pcm.sso_guardar_identidade_os_grupo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_guardar_os_grupo_gate where id),false) then if tg_op='DELETE' then return old; end if; return new; end if;
 if exists(select 1 from pcm.sso_vinculos_os_grupo v where v.os_id=old.id) then
   if tg_op='DELETE' then raise exception 'os_grupo_vinculada_nao_removivel' using errcode='55000'; end if;
   if new.id is distinct from old.id or new.client_id is distinct from old.client_id
      or new.origem is distinct from old.origem or new.origem_ref_id is distinct from old.origem_ref_id
      or new.ocorrencia_preventiva_id is distinct from old.ocorrencia_preventiva_id
      or new.chamado_id is distinct from old.chamado_id or new.deleted_at is distinct from old.deleted_at then
     raise exception 'identidade_os_grupo_vinculada_imutavel' using errcode='55000';
   end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function pcm.sso_guardar_identidade_os_grupo() from public,anon,authenticated,service_role;
create trigger sso_guardar_identidade_os_grupo before update or delete on pcm.ordens_servico for each row execute function pcm.sso_guardar_identidade_os_grupo();
