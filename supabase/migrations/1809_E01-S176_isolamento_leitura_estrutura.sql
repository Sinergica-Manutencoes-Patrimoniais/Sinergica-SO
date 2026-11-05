-- ADR-1667. Gate desligado preserva legado e mantém vazamento: bloqueia release.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'owner_requer_bypassrls' using errcode='42501';
 end if;
end $$;
create table config.sso_estrutura_cliente_leitura_gate (
 id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into config.sso_estrutura_cliente_leitura_gate(id,habilitado) values(true,false);
alter table config.sso_estrutura_cliente_leitura_gate enable row level security;
alter table config.sso_estrutura_cliente_leitura_gate force row level security;
revoke all on config.sso_estrutura_cliente_leitura_gate from public,anon,authenticated,service_role;

create function config.sso_estrutura_cliente_gate_ativo() returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_ativo boolean;
begin
 select habilitado into v_ativo from config.sso_estrutura_cliente_leitura_gate where id for share nowait;
 if not found then raise exception 'gate_estrutura_indisponivel' using errcode='55000';end if;
 if v_ativo then
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
 end if;
 return v_ativo;
end $$;
revoke all on function config.sso_estrutura_cliente_gate_ativo() from public,anon,authenticated,service_role;

create function config.sso_estrutura_cliente_permite_leitura(p_cliente uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
 if not config.sso_estrutura_cliente_gate_ativo() then return true;end if;
 return auth.uid() is not null and p_cliente is not null and
  (config.sso_autorizar_acao('cadastro.ler',p_cliente) is true or config.sso_autorizar_acao('cadastro.gerir',p_cliente) is true);
end $$;
revoke all on function config.sso_estrutura_cliente_permite_leitura(uuid) from public,anon,authenticated,service_role;
grant execute on function config.sso_estrutura_cliente_permite_leitura(uuid) to authenticated;

create function config.sso_estrutura_vinculo_permite_leitura(p_sistema uuid,p_item uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_sistema_cliente uuid;v_item_cliente uuid;
begin
 if not config.sso_estrutura_cliente_gate_ativo() then return true;end if;
 if auth.uid() is null or p_sistema is null or p_item is null then return false;end if;
 select s.cliente_id into v_sistema_cliente from pcm.sistemas s where s.id=p_sistema;
 select e.client_id into v_item_cliente from pcm.equipamentos e where e.id=p_item;
 if v_sistema_cliente is null or v_item_cliente is distinct from v_sistema_cliente then return false;end if;
 return config.sso_autorizar_acao('cadastro.ler',v_sistema_cliente) is true
   or config.sso_autorizar_acao('cadastro.gerir',v_sistema_cliente) is true;
end $$;
revoke all on function config.sso_estrutura_vinculo_permite_leitura(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function config.sso_estrutura_vinculo_permite_leitura(uuid,uuid) to authenticated;

create policy sso_equipamentos_cliente_select on pcm.equipamentos as restrictive for select to authenticated
 using (config.sso_estrutura_cliente_permite_leitura(client_id));
create policy sso_sistemas_cliente_select on pcm.sistemas as restrictive for select to authenticated
 using (config.sso_estrutura_cliente_permite_leitura(cliente_id));
create policy sso_sistema_itens_cliente_select on pcm.sistema_itens as restrictive for select to authenticated
 using (config.sso_estrutura_vinculo_permite_leitura(sistema_id,item_id));
