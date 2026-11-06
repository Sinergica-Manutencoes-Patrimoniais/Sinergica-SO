-- ADR-0734. Proteção aditiva; não altera vínculos históricos existentes.
create index if not exists propostas_assessment_id_idx
  on comercial.propostas (assessment_id) where assessment_id is not null;

create function comercial.sso_validar_assessment_cliente()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cliente_oportunidade uuid; v_cliente_inspecao uuid;
begin
  if new.assessment_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.assessment_id is not distinct from old.assessment_id
    and new.oportunidade_id is not distinct from old.oportunidade_id then return new; end if;
  select cliente_id into v_cliente_oportunidade from comercial.oportunidades
    where id = new.oportunidade_id for share;
  select client_id into v_cliente_inspecao from pcm.inspecoes
    where id = new.assessment_id for share;
  if v_cliente_oportunidade is null or v_cliente_inspecao is null
    or v_cliente_oportunidade is distinct from v_cliente_inspecao then
    raise exception 'vinculo_assessment_invalido' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function comercial.sso_validar_assessment_cliente() from public, anon, authenticated, service_role;
create trigger s181_assessment_cliente before insert or update of assessment_id, oportunidade_id
  on comercial.propostas for each row execute function comercial.sso_validar_assessment_cliente();

create function comercial.sso_proteger_cliente_inspecao_proposta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is not distinct from old.client_id then return new; end if;
  if exists (select 1 from comercial.propostas p
    left join comercial.oportunidades o on o.id = p.oportunidade_id
    where p.assessment_id = old.id and o.cliente_id is distinct from new.client_id) then
    raise exception 'vinculo_assessment_invalido' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function comercial.sso_proteger_cliente_inspecao_proposta() from public, anon, authenticated, service_role;
create trigger s181_proteger_cliente_inspecao before update of client_id on pcm.inspecoes
  for each row execute function comercial.sso_proteger_cliente_inspecao_proposta();

create function comercial.sso_proteger_cliente_oportunidade_proposta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cliente_id is not distinct from old.cliente_id then return new; end if;
  if exists (select 1 from comercial.propostas p
    left join pcm.inspecoes i on i.id = p.assessment_id
    where p.oportunidade_id = old.id and p.assessment_id is not null
      and i.client_id is distinct from new.cliente_id) then
    raise exception 'vinculo_assessment_invalido' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function comercial.sso_proteger_cliente_oportunidade_proposta() from public, anon, authenticated, service_role;
create trigger s181_proteger_cliente_oportunidade before update of cliente_id on comercial.oportunidades
  for each row execute function comercial.sso_proteger_cliente_oportunidade_proposta();
