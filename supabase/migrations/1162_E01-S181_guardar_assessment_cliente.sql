-- ADR-1010: guarda de integridade, gate fechado e sem correção histórica.
create table comercial.sso_assessment_cliente_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_assessment_cliente_gate(id,habilitado) values(true,false);
alter table comercial.sso_assessment_cliente_gate enable row level security;
alter table comercial.sso_assessment_cliente_gate force row level security;
revoke all on comercial.sso_assessment_cliente_gate from public,anon,authenticated,service_role;

create function comercial.sso_guardar_cliente_assessment() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_cliente_oportunidade uuid; v_cliente_inspecao uuid;
begin
  select g.habilitado into v_ativo from comercial.sso_assessment_cliente_gate g where g.id for share;
  if v_ativo is distinct from true then return new; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-assessment-proposta-cliente',0)) then raise exception 'assessment_em_alteracao' using errcode='55P03'; end if;
  if tg_table_schema='comercial' and tg_table_name='propostas' then
    if new.assessment_id is null then return new; end if;
    select o.cliente_id into v_cliente_oportunidade from comercial.oportunidades o where o.id=new.oportunidade_id;
    select i.client_id into v_cliente_inspecao from pcm.inspecoes i where i.id=new.assessment_id;
    if v_cliente_oportunidade is null or v_cliente_inspecao is distinct from v_cliente_oportunidade then raise exception 'assessment_cliente_divergente' using errcode='23514'; end if;
  elsif tg_table_schema='comercial' and tg_table_name='oportunidades' then
    if exists(select 1 from comercial.propostas p left join pcm.inspecoes i on i.id=p.assessment_id
      where p.oportunidade_id=new.id and p.assessment_id is not null and i.client_id is distinct from new.cliente_id) then
      raise exception 'assessment_cliente_divergente' using errcode='23514'; end if;
  elsif tg_table_schema='pcm' and tg_table_name='inspecoes' then
    if exists(select 1 from comercial.propostas p join comercial.oportunidades o on o.id=p.oportunidade_id
      where p.assessment_id=new.id and o.cliente_id is distinct from new.client_id) then
      raise exception 'assessment_cliente_divergente' using errcode='23514'; end if;
  else raise exception 'origem_invalida' using errcode='22023'; end if;
  return new;
end;
$$;
revoke all on function comercial.sso_guardar_cliente_assessment() from public,anon,authenticated,service_role;
create trigger sso_assessment_cliente_proposta before insert or update of assessment_id,oportunidade_id on comercial.propostas for each row execute function comercial.sso_guardar_cliente_assessment();
create trigger sso_assessment_cliente_oportunidade before update of cliente_id on comercial.oportunidades for each row when (old.cliente_id is distinct from new.cliente_id) execute function comercial.sso_guardar_cliente_assessment();
create trigger sso_assessment_cliente_inspecao before update of client_id on pcm.inspecoes for each row when (old.client_id is distinct from new.client_id) execute function comercial.sso_guardar_cliente_assessment();
