-- ADR-0855: proteção opt-in, sem liberar 1:N.
create table pcm.sso_guarda_cancelado_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
alter table pcm.sso_guarda_cancelado_gate enable row level security;
alter table pcm.sso_guarda_cancelado_gate force row level security;
revoke all on pcm.sso_guarda_cancelado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_guarda_cancelado_gate(id,habilitado) values(true,false);

create function pcm.sso_guardar_vinculo_os_cancelado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_gate boolean; v_chamado record; v_antigo uuid; v_novo uuid; v_antigo_os uuid; v_os uuid;
begin
 select habilitado into v_gate from pcm.sso_guarda_cancelado_gate where id for share;
 if not coalesce(v_gate,false) then if tg_op='DELETE' then return old; end if; return new; end if;
 if tg_op='DELETE' then v_antigo:=old.chamado_id; v_antigo_os:=old.id; v_os:=old.id;
 elsif tg_op='INSERT' then v_novo:=new.chamado_id; v_os:=new.id;
 else
  if new.id is not distinct from old.id and new.chamado_id is not distinct from old.chamado_id and new.client_id is not distinct from old.client_id and new.deleted_at is not distinct from old.deleted_at and (new.status is not distinct from old.status or new.status='finalizado') then return new; end if;
  v_antigo:=old.chamado_id; v_novo:=new.chamado_id; v_antigo_os:=old.id; v_os:=new.id;
 end if;
 for v_chamado in select c.id,c.status from pcm.chamados c where c.id=v_antigo or c.id=v_novo or c.ordem_servico_id=v_antigo_os or c.ordem_servico_id=v_os order by c.id for share loop
  if v_chamado.status='cancelado' then raise exception 'chamado_cancelado_requer_tratamento_formal' using errcode='23514'; end if;
 end loop;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function pcm.sso_guardar_vinculo_os_cancelado() from public,anon,authenticated,service_role;
create trigger sso_guardar_vinculo_os_cancelado before insert or delete or update of id,chamado_id,client_id,status,deleted_at on pcm.ordens_servico for each row execute function pcm.sso_guardar_vinculo_os_cancelado();

create function pcm.sso_guardar_referencia_cancelado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_gate boolean; v_direto uuid; v_chamado record;
begin
 if new.ordem_servico_id is not distinct from old.ordem_servico_id then return new; end if;
 select habilitado into v_gate from pcm.sso_guarda_cancelado_gate where id for share;
 if not coalesce(v_gate,false) then return new; end if;
 if old.status='cancelado' or new.status='cancelado' then raise exception 'chamado_cancelado_requer_tratamento_formal' using errcode='23514'; end if;
 if new.ordem_servico_id is null then return new; end if;
 select o.chamado_id into v_direto from pcm.ordens_servico o where o.id=new.ordem_servico_id for update;
 for v_chamado in select c.id,c.status from pcm.chamados c where c.id<>new.id and (c.id=v_direto or c.ordem_servico_id=new.ordem_servico_id) order by c.id for share loop
  if v_chamado.status='cancelado' then raise exception 'chamado_cancelado_requer_tratamento_formal' using errcode='23514'; end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_referencia_cancelado() from public,anon,authenticated,service_role;
create trigger sso_guardar_referencia_cancelado before update of ordem_servico_id on pcm.chamados for each row execute function pcm.sso_guardar_referencia_cancelado();
