-- ADR-1021: coordenação desativada por padrão.
create table pcm.sso_coordenacao_feriados_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_coordenacao_feriados_gate(id,habilitado) values(true,false);
alter table pcm.sso_coordenacao_feriados_gate enable row level security;
alter table pcm.sso_coordenacao_feriados_gate force row level security;
revoke all on pcm.sso_coordenacao_feriados_gate from public,anon,authenticated,service_role;
create function pcm.sso_coordenar_escrita_feriado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_primeiro uuid; v_segundo uuid;
begin
  select g.habilitado into v_ativo from pcm.sso_coordenacao_feriados_gate g where g.id for share;
  if v_ativo is distinct from true then if tg_op='DELETE' then return old; else return new; end if; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if tg_op='INSERT' then v_primeiro:=new.cliente_id;
  elsif tg_op='DELETE' then v_primeiro:=old.cliente_id;
  else v_primeiro:=least(old.cliente_id,new.cliente_id); if old.cliente_id is distinct from new.cliente_id then v_segundo:=greatest(old.cliente_id,new.cliente_id); end if; end if;
  if v_primeiro is null or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-feriados-cliente:'||v_primeiro::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if v_segundo is not null and not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-feriados-cliente:'||v_segundo::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function pcm.sso_coordenar_escrita_feriado() from public,anon,authenticated,service_role;
create trigger sso_feriados_coordenar_escrita before insert or update or delete on pcm.feriados_declarados for each row execute function pcm.sso_coordenar_escrita_feriado();
