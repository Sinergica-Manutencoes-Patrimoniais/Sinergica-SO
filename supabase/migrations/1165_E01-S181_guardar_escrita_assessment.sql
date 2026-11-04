-- ADR-1014: guarda somente UPDATE de vínculo, gate fechado.
create table comercial.sso_escrita_assessment_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_escrita_assessment_gate(id,habilitado) values(true,false);
create table comercial.sso_escrita_assessment_permissoes (
  transacao bigint not null, proposta_id uuid not null, assessment_anterior uuid, assessment_novo uuid,
  primary key(transacao,proposta_id)
);
alter table comercial.sso_escrita_assessment_gate enable row level security;
alter table comercial.sso_escrita_assessment_gate force row level security;
alter table comercial.sso_escrita_assessment_permissoes enable row level security;
alter table comercial.sso_escrita_assessment_permissoes force row level security;
revoke all on comercial.sso_escrita_assessment_gate,comercial.sso_escrita_assessment_permissoes from public,anon,authenticated,service_role;
create function comercial.sso_guardar_escrita_assessment() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean;
begin
  if new.assessment_id is not distinct from old.assessment_id then return new; end if;
  select g.habilitado into v_ativo from comercial.sso_escrita_assessment_gate g where g.id for share;
  if v_ativo is distinct from true then return new; end if;
  if not exists(select 1 from comercial.sso_escrita_assessment_permissoes p where p.transacao=pg_catalog.txid_current() and p.proposta_id=new.id
    and p.assessment_anterior is not distinct from old.assessment_id and p.assessment_novo is not distinct from new.assessment_id) then
    raise exception 'vinculo_assessment_exige_comando' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function comercial.sso_guardar_escrita_assessment() from public,anon,authenticated,service_role;
create trigger sso_escrita_assessment_mediada before update of assessment_id on comercial.propostas for each row execute function comercial.sso_guardar_escrita_assessment();
