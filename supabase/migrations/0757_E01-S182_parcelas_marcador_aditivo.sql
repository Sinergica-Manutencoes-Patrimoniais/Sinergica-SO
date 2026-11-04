-- ADR-0532: identidade aditiva, gate desligado e unicidade legada para primeiras parcelas.
create table financeiro.sso_parcela_adicional_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_parcela_adicional_gate(id,habilitado) values(true,false);
alter table financeiro.sso_parcela_adicional_gate enable row level security;
alter table financeiro.sso_parcela_adicional_gate force row level security;
revoke all on financeiro.sso_parcela_adicional_gate from public,anon,authenticated,service_role;
alter table financeiro.sso_faturavel_alocacoes add column parcela_adicional boolean not null default false;
alter table financeiro.sso_faturavel_alocacoes drop constraint sso_faturavel_alocacoes_item_id_documento_id_key;
create unique index sso_alocacao_primeira_item_documento on financeiro.sso_faturavel_alocacoes(item_id,documento_id) where not parcela_adicional;

create function financeiro.sso_preparar_parcela_adicional() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_parcela_adicional_gate where id),false) then new.parcela_adicional:=false; return new; end if;
  perform 1 from financeiro.itens_faturaveis where id=new.item_id for update;
  if not found then raise exception 'item_inexistente' using errcode='23503'; end if;
  new.parcela_adicional:=exists(select 1 from financeiro.sso_faturavel_alocacoes a where a.item_id=new.item_id and a.documento_id=new.documento_id and not a.parcela_adicional);
  return new;
end $$;
revoke all on function financeiro.sso_preparar_parcela_adicional() from public,anon,authenticated,service_role;
create trigger sso_preparar_parcela_adicional before insert on financeiro.sso_faturavel_alocacoes for each row execute function financeiro.sso_preparar_parcela_adicional();

create function financeiro.sso_proteger_ancora_parcela() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.id is distinct from old.id or new.item_id is distinct from old.item_id or new.documento_id is distinct from old.documento_id
      or new.parcela_adicional is distinct from old.parcela_adicional or new.request_id is distinct from old.request_id then raise exception 'identidade_parcela_imutavel' using errcode='23514'; end if;
    return new;
  end if;
  if not old.parcela_adicional then
    perform 1 from financeiro.itens_faturaveis where id=old.item_id for update;
    if exists(select 1 from financeiro.sso_faturavel_alocacoes a where a.item_id=old.item_id and a.documento_id=old.documento_id and a.parcela_adicional) then raise exception 'ancora_parcela_em_uso' using errcode='23514'; end if;
  end if;
  return old;
end $$;
revoke all on function financeiro.sso_proteger_ancora_parcela() from public,anon,authenticated,service_role;
create trigger sso_proteger_ancora_parcela before update or delete on financeiro.sso_faturavel_alocacoes for each row execute function financeiro.sso_proteger_ancora_parcela();
