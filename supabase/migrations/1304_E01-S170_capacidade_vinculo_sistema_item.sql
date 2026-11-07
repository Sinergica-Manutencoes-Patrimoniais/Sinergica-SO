-- ADR-1136: proteção inicialmente desligada, sem modificar vínculos existentes.
create function pcm.sso_guardar_capacidade_vinculo_sistema_item() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_habilitado boolean;v_servico boolean;v_servico_autorizado boolean:=false;v_id uuid;v_cliente uuid;
 v_sistema_antigo uuid;v_sistema_novo uuid;v_item_antigo uuid;v_item_novo uuid;
 v_cliente_sistema_novo uuid;v_cliente_item_novo uuid;
begin
 select habilitado,permitir_servico into v_habilitado,v_servico from config.sso_capacidade_cadastros_legados_gate where id for share;
 if not found then raise exception 'configuracao_indisponivel' using errcode='55000'; end if;
 if not v_habilitado then if tg_op='DELETE' then return old; end if; return new; end if;
 if auth.uid() is null then
  if auth.role()='service_role' and v_servico then v_servico_autorizado:=true;
  else raise exception 'sem_acesso' using errcode='42501'; end if;
 end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if tg_op<>'INSERT' then v_sistema_antigo:=old.sistema_id;v_item_antigo:=old.item_id; end if;
 if tg_op<>'DELETE' then v_sistema_novo:=new.sistema_id;v_item_novo:=new.item_id; end if;
 for v_id in select distinct x from unnest(array[v_sistema_antigo,v_sistema_novo]) x where x is not null order by x loop
  select cliente_id into v_cliente from pcm.sistemas where id=v_id for share;
  if not found or v_cliente is null or (not v_servico_autorizado and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_id=v_sistema_novo then v_cliente_sistema_novo:=v_cliente; end if;
 end loop;
 for v_id in select distinct x from unnest(array[v_item_antigo,v_item_novo]) x where x is not null order by x loop
  select client_id into v_cliente from pcm.equipamentos where id=v_id for share;
  if not found or v_cliente is null or (not v_servico_autorizado and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_id=v_item_novo then v_cliente_item_novo:=v_cliente; end if;
 end loop;
 if tg_op<>'DELETE' and (v_sistema_novo is null or v_item_novo is null or v_cliente_sistema_novo is null or v_cliente_item_novo is null
  or v_cliente_sistema_novo is distinct from v_cliente_item_novo) then raise exception 'vinculo_invalido' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function pcm.sso_guardar_capacidade_vinculo_sistema_item() from public,anon,authenticated,service_role;
create trigger sso_capacidade_cadastro_sistema_item before insert or update or delete on pcm.sistema_itens
 for each row execute function pcm.sso_guardar_capacidade_vinculo_sistema_item();
