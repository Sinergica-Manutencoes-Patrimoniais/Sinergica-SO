-- ADR-1668. Nenhuma leitura nova ocorre com gate 1809 desligado.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'owner_requer_bypassrls' using errcode='42501';end if;
end $$;
create function pcm.sso_listar_composicao_estrutura_176(
 p_ator uuid,p_cliente uuid,p_fonte text,p_local uuid,p_sistema uuid,p_apenas_ativos boolean,p_offset integer
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_fonte is null or p_fonte not in ('sistemas','locais','itens','vinculos','grupos','categorias')
  or p_apenas_ativos is null or p_offset is null or p_offset<0 or p_offset>2147483597 then
  raise exception 'consulta_invalida' using errcode='22023';end if;
 if not config.sso_estrutura_cliente_gate_ativo() then raise exception 'isolamento_desabilitado' using errcode='55000';end if;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente) is distinct from true
    and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';end if;
 -- Preserva as políticas legadas das cinco fontes que exigem claim PCM assinado.
 -- Grupos usam a política de capacidade por Cliente e não exigem esse claim adicional.
 if p_fonte<>'grupos' and (auth.jwt()->>'user_role'='superadmin'
    or auth.jwt()->'user_modulos'->>'pcm' in ('leitura','escrita')) is not true then
  raise exception 'sem_acesso' using errcode='42501';end if;
 if p_fonte='sistemas' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) into v_resultado from (
   select s.id,s.cliente_id,s.nome,s.ativo from pcm.sistemas s where s.cliente_id=p_cliente and s.deleted_at is null
    and (p_sistema is null or s.id=p_sistema) order by s.id offset p_offset limit 50) t;
 elsif p_fonte='locais' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) into v_resultado from (
   select l.id,l.nome,l.ativo from pcm.locais l join pcm.areas a on a.id=l.area_id
    where a.cliente_id=p_cliente and l.deleted_at is null order by l.id offset p_offset limit 50) t;
 elsif p_fonte='itens' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) into v_resultado from (
   select e.id,e.client_id,e.local_id,e.ativo,e.nome,e.tipo,e.identificador,e.parent_item_id,e.categoria from pcm.equipamentos e
    where e.client_id=p_cliente and e.deleted_at is null and (p_local is null or e.local_id=p_local)
     and (not p_apenas_ativos or e.ativo) order by e.id offset p_offset limit 50) t;
 elsif p_fonte='vinculos' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.sistema_id,t.item_id),'[]'::jsonb) into v_resultado from (
   select v.sistema_id,v.item_id,jsonb_build_object('nome',s.nome,'ativo',s.ativo) sistemas
    from pcm.sistema_itens v join pcm.sistemas s on s.id=v.sistema_id join pcm.equipamentos e on e.id=v.item_id
    where s.cliente_id=p_cliente and e.client_id=p_cliente and (p_local is null or e.local_id=p_local)
     and (p_sistema is null or s.id=p_sistema) order by v.sistema_id,v.item_id offset p_offset limit 50) t;
 elsif p_fonte='grupos' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) into v_resultado from (
   select g.id,g.cliente_id,g.local_id,g.categoria_id,g.sistema_id,g.nome,g.quantidade,g.caracteristicas,g.revisao
    from pcm.grupos_quantitativos g where g.cliente_id=p_cliente and g.deleted_at is null and g.ativo
     and (p_local is null or g.local_id=p_local) and (p_sistema is null or g.sistema_id=p_sistema)
    order by g.id offset p_offset limit 50) t;
 else
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) into v_resultado from (
   select c.id,c.nome from pcm.equipamento_categorias c where c.deleted_at is null order by c.id offset p_offset limit 50) t;
 end if;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente) is distinct from true
    and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';end if;
 return v_resultado;
end $$;
revoke all on function pcm.sso_listar_composicao_estrutura_176(uuid,uuid,text,uuid,uuid,boolean,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_composicao_estrutura_176(uuid,uuid,text,uuid,uuid,boolean,integer) to authenticated;
