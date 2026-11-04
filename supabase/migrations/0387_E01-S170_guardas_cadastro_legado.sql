-- ADR-0161: desligado por padrão; não aplicar ou ativar sem rollout coordenado.
create table config.sso_guardas_cadastro_gate (
  tabela text primary key check(tabela in ('areas','locais','sistemas','equipamentos')),
  habilitado boolean not null default false
);
insert into config.sso_guardas_cadastro_gate(tabela) values('areas'),('locais'),('sistemas'),('equipamentos');
alter table config.sso_guardas_cadastro_gate enable row level security;
alter table config.sso_guardas_cadastro_gate force row level security;
revoke all on config.sso_guardas_cadastro_gate from public,anon,authenticated,service_role;

create function config.sso_guardar_cadastro_legado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_antes jsonb; v_depois jsonb; v_cliente_antes uuid; v_cliente_depois uuid;
begin
  if not coalesce((select g.habilitado from config.sso_guardas_cadastro_gate g where g.tabela=tg_table_name),false) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op<>'INSERT' then v_antes:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then v_depois:=to_jsonb(new); end if;
  if tg_table_name='locais' then
    if v_antes is not null then select a.cliente_id into v_cliente_antes from pcm.areas a where a.id=(v_antes->>'area_id')::uuid; end if;
    if v_depois is not null then select a.cliente_id into v_cliente_depois from pcm.areas a where a.id=(v_depois->>'area_id')::uuid; end if;
  elsif tg_table_name='equipamentos' then
    v_cliente_antes:=(v_antes->>'client_id')::uuid; v_cliente_depois:=(v_depois->>'client_id')::uuid;
  else
    v_cliente_antes:=(v_antes->>'cliente_id')::uuid; v_cliente_depois:=(v_depois->>'cliente_id')::uuid;
  end if;
  if auth.uid() is null or (v_antes is not null and (v_cliente_antes is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente_antes) is not true))
    or (v_depois is not null and (v_cliente_depois is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente_depois) is not true)) then
    raise exception 'cadastro_nao_encontrado_ou_sem_capacidade' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function config.sso_guardar_cadastro_legado() from public,anon,authenticated,service_role;
create trigger sso_capacidade_area before insert or update or delete on pcm.areas for each row execute function config.sso_guardar_cadastro_legado();
create trigger sso_capacidade_local before insert or update or delete on pcm.locais for each row execute function config.sso_guardar_cadastro_legado();
create trigger sso_capacidade_sistema before insert or update or delete on pcm.sistemas for each row execute function config.sso_guardar_cadastro_legado();
create trigger sso_capacidade_equipamento before insert or update or delete on pcm.equipamentos for each row execute function config.sso_guardar_cadastro_legado();
