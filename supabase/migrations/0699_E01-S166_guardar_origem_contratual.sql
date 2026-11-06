-- ADR-0473: identidade série/semana em inserções novas, opt-in após inventário.
create table pcm.sso_origem_contratual_unica_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_origem_contratual_unica_gate enable row level security;
alter table pcm.sso_origem_contratual_unica_gate force row level security;
revoke all on pcm.sso_origem_contratual_unica_gate from public,anon,authenticated,service_role;
insert into pcm.sso_origem_contratual_unica_gate(id,habilitado) values(true,false);

create function pcm.sso_conferir_gate_origem_unica() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.habilitado and not old.habilitado and exists(select 1 from pcm.visita_origem_contratual group by serie_id,semana_origem having count(*)>1) then raise exception 'origens_duplicadas_exigem_reconciliacao' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_conferir_gate_origem_unica() from public,anon,authenticated,service_role;
create trigger sso_conferir_gate_origem_unica before update of habilitado on pcm.sso_origem_contratual_unica_gate for each row execute function pcm.sso_conferir_gate_origem_unica();

create function pcm.sso_guardar_origem_contratual_unica() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_origem_contratual_unica_gate where id),false) then return new; end if;
 perform 1 from pcm.calendario_contratual_series where id=new.serie_id and cliente_id=new.cliente_id for update;
 if not found then raise exception 'serie_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.visita_origem_contratual where serie_id=new.serie_id and semana_origem=new.semana_origem) then raise exception 'origem_contratual_duplicada' using errcode='23505'; end if;
 if exists(select 1 from pcm.sso_geracao_visita_contratual where serie_id=new.serie_id and semana=new.semana_origem and decisao='suprimida_feriado') then raise exception 'semana_suprimida_exige_reconciliacao' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_origem_contratual_unica() from public,anon,authenticated,service_role;
create trigger sso_guardar_origem_contratual_unica before insert on pcm.visita_origem_contratual for each row execute function pcm.sso_guardar_origem_contratual_unica();
