-- ADR-0730: integridade do rascunho autenticado; dados anteriores não são alterados.
create function comercial.sso_e03_s07_validar_origem_contrato()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Triggers administrativos/serviços existentes não são convertidos em chamadas de usuário.
  if current_setting('role',true) is distinct from 'authenticated' then return new; end if;
  if auth.uid() is null or new.created_by is distinct from auth.uid()
     or config.sso_e03_s07_modulo_atual('comercial',true) is not true then
    raise exception 'contrato_indisponivel_ou_sem_acesso' using errcode='42501';
  end if;
  perform 1 from comercial.propostas p
    join comercial.oportunidades o on o.id=p.oportunidade_id
    where p.id=new.proposta_id and p.status='aceita' and p.deleted_at is null
      and o.cliente_id=new.cliente_id and o.deleted_at is null
    for share of p,o;
  if not found then raise exception 'contrato_indisponivel_ou_sem_acesso' using errcode='23514'; end if;
  if config.sso_e03_s07_modulo_atual('comercial',true) is not true then
    raise exception 'contrato_indisponivel_ou_sem_acesso' using errcode='42501';
  end if;
  return new;
end; $$;
revoke all on function comercial.sso_e03_s07_validar_origem_contrato() from public,anon,authenticated,service_role;
create trigger e03_s07_validar_origem_contrato before insert on comercial.contratos
for each row execute function comercial.sso_e03_s07_validar_origem_contrato();
