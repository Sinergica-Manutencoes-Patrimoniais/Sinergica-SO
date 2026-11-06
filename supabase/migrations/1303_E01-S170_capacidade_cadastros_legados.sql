-- ADR-1135: guards aditivas inicialmente inativas; não concedem privilégios.
create table config.sso_capacidade_cadastros_legados_gate(
 id boolean primary key default true check(id), habilitado boolean not null default false,
 permitir_servico boolean not null default false
);
insert into config.sso_capacidade_cadastros_legados_gate(id,habilitado,permitir_servico) values(true,false,false);
alter table config.sso_capacidade_cadastros_legados_gate enable row level security;
alter table config.sso_capacidade_cadastros_legados_gate force row level security;
revoke all on config.sso_capacidade_cadastros_legados_gate from public,anon,authenticated,service_role;

create function pcm.sso_guardar_capacidade_cadastro_legado() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_habilitado boolean;v_servico boolean;v_antigo uuid;v_novo uuid;v_area_antiga uuid;v_area_nova uuid;v_area uuid;
begin
 select habilitado,permitir_servico into v_habilitado,v_servico from config.sso_capacidade_cadastros_legados_gate where id for share;
 if not found then raise exception 'configuracao_indisponivel' using errcode='55000'; end if;
 if not v_habilitado then if tg_op='DELETE' then return old; end if; return new; end if;
 if auth.uid() is null then
  if auth.role()='service_role' and v_servico then if tg_op='DELETE' then return old; end if; return new; end if;
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if tg_table_schema<>'pcm' or tg_table_name not in ('areas','locais','sistemas','equipamentos') then raise exception 'origem_invalida' using errcode='55000'; end if;
 if tg_table_name='locais' then
  if tg_op<>'INSERT' then v_area_antiga:=old.area_id; end if;
  if tg_op<>'DELETE' then v_area_nova:=new.area_id; end if;
  -- Ordem de UUID reduz disputa entre mudanças de Área opostas.
  for v_area in select distinct a from unnest(array[v_area_antiga,v_area_nova]) a where a is not null order by a loop
   perform 1 from pcm.areas where id=v_area for share;
   if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  end loop;
  if v_area_antiga is not null then select cliente_id into v_antigo from pcm.areas where id=v_area_antiga; end if;
  if v_area_nova is not null then select cliente_id into v_novo from pcm.areas where id=v_area_nova; end if;
 elsif tg_table_name='equipamentos' then
  if tg_op<>'INSERT' then v_antigo:=old.client_id; end if;
  if tg_op<>'DELETE' then v_novo:=new.client_id; end if;
 else
  if tg_op<>'INSERT' then v_antigo:=old.cliente_id; end if;
  if tg_op<>'DELETE' then v_novo:=new.cliente_id; end if;
 end if;
 if (tg_op<>'INSERT' and (v_antigo is null or config.sso_autorizar_acao('cadastro.gerir',v_antigo) is distinct from true))
  or (tg_op<>'DELETE' and (v_novo is null or config.sso_autorizar_acao('cadastro.gerir',v_novo) is distinct from true)) then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function pcm.sso_guardar_capacidade_cadastro_legado() from public,anon,authenticated,service_role;
create trigger sso_capacidade_cadastro_area before insert or update or delete on pcm.areas for each row execute function pcm.sso_guardar_capacidade_cadastro_legado();
create trigger sso_capacidade_cadastro_local before insert or update or delete on pcm.locais for each row execute function pcm.sso_guardar_capacidade_cadastro_legado();
create trigger sso_capacidade_cadastro_sistema before insert or update or delete on pcm.sistemas for each row execute function pcm.sso_guardar_capacidade_cadastro_legado();
create trigger sso_capacidade_cadastro_equipamento before insert or update or delete on pcm.equipamentos for each row execute function pcm.sso_guardar_capacidade_cadastro_legado();
