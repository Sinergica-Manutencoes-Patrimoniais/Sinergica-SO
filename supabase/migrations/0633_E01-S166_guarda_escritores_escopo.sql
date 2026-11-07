-- ADR-0407: opt-in; não afirma integralidade da declaração e não encerra ocorrência.
create table pcm.sso_guardar_escopo_preventivo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_guardar_escopo_preventivo_gate enable row level security;
alter table pcm.sso_guardar_escopo_preventivo_gate force row level security;
revoke all on pcm.sso_guardar_escopo_preventivo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_guardar_escopo_preventivo_gate(id,habilitado) values(true,false);

create function pcm.sso_guardar_escrita_os_escopo_preventivo() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_antiga uuid; v_nova uuid; v_preparada uuid;
begin
 if not coalesce((select habilitado from pcm.sso_guardar_escopo_preventivo_gate where id),false) then
   if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op<>'INSERT' then v_antiga:=old.ocorrencia_preventiva_id; end if;
 if tg_op<>'DELETE' then v_nova:=new.ocorrencia_preventiva_id; end if;
 if tg_op='UPDATE' and old.ocorrencia_preventiva_id is not distinct from new.ocorrencia_preventiva_id
   and old.client_id is not distinct from new.client_id and old.deleted_at is not distinct from new.deleted_at then return new; end if;
 -- Mesmo lock utilizado por 0626; ordem estável quando uma OS muda de ocorrência.
 for v_preparada in select o.id from pcm.ocorrencias_rotina_preparadas o
   join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id
   where v.ocorrencia_legada_id in (v_antiga,v_nova) order by o.id for update of o
 loop
   if exists(select 1 from pcm.sso_declaracoes_escopo_preventivo d where d.ocorrencia_preparada_id=v_preparada) then
     raise exception 'escopo_preventivo_declarado_requer_reconciliacao' using errcode='23514';
   end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function pcm.sso_guardar_escrita_os_escopo_preventivo() from public,anon,authenticated,service_role;
create trigger sso_guardar_os_escopo_preventivo before insert or update or delete on pcm.ordens_servico for each row execute function pcm.sso_guardar_escrita_os_escopo_preventivo();
