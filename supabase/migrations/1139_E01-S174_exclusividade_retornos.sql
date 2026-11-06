-- ADR-0986: reserva comum às duas filas. Conflitos no backfill abortam a migration.
create table pcm.sso_reservas_retorno_backlog(
  pendencia_id uuid primary key references pcm.sso_pendencias_tecnicas(id),
  tipo text not null check(tipo in ('integral','parcial')),retorno_id uuid not null,cliente_id uuid not null references pcm.clientes(id),
  criado_em timestamptz not null default now(),unique(tipo,retorno_id)
);
alter table pcm.sso_reservas_retorno_backlog enable row level security;
alter table pcm.sso_reservas_retorno_backlog force row level security;
revoke all on pcm.sso_reservas_retorno_backlog from public,anon,authenticated,service_role;
insert into pcm.sso_reservas_retorno_backlog(pendencia_id,tipo,retorno_id,cliente_id)
  select pendencia_id,'integral',id,cliente_id from pcm.sso_retornos_ciclo_backlog where estado='aguardando'
  union all
  select pendencia_id,'parcial',id,cliente_id from pcm.sso_retornos_parciais where estado='aguardando';

create function pcm.sso_reservar_retorno_backlog() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tipo text;
begin
  v_tipo:=case tg_table_name when 'sso_retornos_ciclo_backlog' then 'integral' when 'sso_retornos_parciais' then 'parcial' else null end;
  if v_tipo is null then raise exception 'origem_retorno_invalida' using errcode='23514'; end if;
  if tg_op='DELETE' then raise exception 'historico_retorno_imutavel' using errcode='23514'; end if;
  if tg_op='INSERT' then
    if new.estado is distinct from 'aguardando' or new.revisao is distinct from 1 then raise exception 'retorno_inicial_invalido' using errcode='23514'; end if;
    perform 1 from pcm.sso_pendencias_tecnicas p where p.id=new.pendencia_id and p.cliente_id=new.cliente_id for update;
    if not found then raise exception 'pendencia_indisponivel' using errcode='23514'; end if;
    insert into pcm.sso_reservas_retorno_backlog(pendencia_id,tipo,retorno_id,cliente_id) values(new.pendencia_id,v_tipo,new.id,new.cliente_id);
    return new;
  end if;
  if (to_jsonb(new)-'estado'-'revisao') is distinct from (to_jsonb(old)-'estado'-'revisao')
    or old.estado is distinct from 'aguardando' or new.estado is distinct from 'promovido' or new.revisao is distinct from old.revisao+1 then
    raise exception 'transicao_retorno_invalida' using errcode='23514'; end if;
  perform 1 from pcm.sso_pendencias_tecnicas p where p.id=old.pendencia_id and p.cliente_id=old.cliente_id for update;
  if not found then raise exception 'pendencia_indisponivel' using errcode='23514'; end if;
  delete from pcm.sso_reservas_retorno_backlog where pendencia_id=old.pendencia_id and tipo=v_tipo and retorno_id=old.id and cliente_id=old.cliente_id;
  if not found then raise exception 'reserva_retorno_inconsistente' using errcode='23514'; end if;
  return new;
end; $$;
revoke all on function pcm.sso_reservar_retorno_backlog() from public,anon,authenticated,service_role;
create trigger sso_reservar_retorno_integral before insert or update or delete on pcm.sso_retornos_ciclo_backlog
for each row execute function pcm.sso_reservar_retorno_backlog();
create trigger sso_reservar_retorno_parcial before insert or update or delete on pcm.sso_retornos_parciais
for each row execute function pcm.sso_reservar_retorno_backlog();
