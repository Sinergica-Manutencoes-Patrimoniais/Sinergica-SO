-- ADR-1678: leitura pontual com o mesmo escopo da composição mediada 1810.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'owner_requer_bypassrls' using errcode='42501'; end if;
end $$;
create function pcm.sso_membro_sistema_por_id_176(p_ator uuid,p_cliente uuid,p_sistema uuid,p_item uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_sistema is null or p_item is null then
  raise exception 'sem_acesso' using errcode='42501'; end if;
 if not config.sso_estrutura_cliente_gate_ativo() then raise exception 'isolamento_desabilitado' using errcode='55000'; end if;
 if (auth.jwt()->>'user_role'='superadmin' or auth.jwt()->'user_modulos'->>'pcm' in ('leitura','escrita')) is not true
  or (config.sso_autorizar_acao('cadastro.ler',p_cliente) is distinct from true and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true) then
  raise exception 'sem_acesso' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object('id',e.id,'client_id',e.client_id,'local_id',e.local_id,'ativo',e.ativo,'nome',e.nome,'tipo',e.tipo,'identificador',e.identificador,'parent_item_id',e.parent_item_id)
 into v_resultado from pcm.sistema_itens v join pcm.sistemas s on s.id=v.sistema_id
 join pcm.equipamentos e on e.id=v.item_id
 where v.sistema_id=p_sistema and v.item_id=p_item and s.cliente_id=p_cliente and e.client_id=p_cliente
  and s.deleted_at is null and e.deleted_at is null and e.ativo
 for share of v,s,e nowait;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente) is distinct from true
  and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end $$;
revoke all on function pcm.sso_membro_sistema_por_id_176(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_membro_sistema_por_id_176(uuid,uuid,uuid,uuid) to authenticated;
