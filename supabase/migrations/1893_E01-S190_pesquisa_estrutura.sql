-- ADR-1701 / E01-S190 AC-9/AC-10: leitura tipada, sem alterar entidades ou dados.
-- Reverso: retirar consumidor; revoke execute on function pcm.sso_pesquisar_estrutura(uuid,text,text,text,uuid,text,integer) from authenticated;
-- drop function pcm.sso_pesquisar_estrutura(uuid,text,text,text,uuid,text,integer);
create function pcm.sso_pesquisar_estrutura(
 p_cliente_id uuid, p_busca text default '', p_tipo text default null,
 p_contexto_tipo text default null, p_contexto_id uuid default null,
 p_apos text default null, p_limite integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_busca text; v_resultado jsonb;
begin
 if auth.uid() is null or p_cliente_id is null
  or config.sso_acesso_atual('pcm','leitura') is distinct from true
  or (config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is distinct from true
      and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true) then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 if p_busca is null or length(p_busca)>200 or p_limite is null or p_limite<1 or p_limite>100
  or (p_tipo is not null and p_tipo not in ('','area','local','sistema','equipamento','componente','grupo_quantitativo'))
  or ((p_contexto_tipo is null) <> (p_contexto_id is null))
  or (p_contexto_tipo is not null and p_contexto_tipo not in ('area','local','sistema','equipamento','componente','grupo_quantitativo'))
  or (p_apos is not null and (length(p_apos)>60 or p_apos !~ '^(area|local|sistema|equipamento|componente|grupo_quantitativo):[0-9a-f-]{36}$')) then
  raise exception 'consulta_invalida' using errcode='22023';
 end if;
 v_busca := translate(lower(btrim(p_busca)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc');
 with entidades as (
  select 'area'::text tipo,a.id,a.nome,a.sigla codigo,a.id area_id,
   null::uuid local_id,null::uuid sistema_id,null::uuid parent_id
  from pcm.areas a where a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null
  union all
  select 'local',l.id,l.nome,l.sigla,l.area_id,l.id,null,l.parent_id
  from pcm.locais l join pcm.areas a on a.id=l.area_id
  where a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null
  union all
  select 'sistema',s.id,s.nome,s.codigo,s.area_id,s.local_id,s.id,null
  from pcm.sistemas s where s.cliente_id=p_cliente_id and s.ativo and s.deleted_at is null
  union all
  select e.tipo,e.id,e.nome,e.identificador,e.area_id,e.local_id,v.sistema_id,e.parent_item_id
  from pcm.equipamentos e left join lateral (
   select si.sistema_id from pcm.sistema_itens si join pcm.sistemas s on s.id=si.sistema_id
   where si.item_id=e.id and s.cliente_id=p_cliente_id and s.ativo and s.deleted_at is null
   order by si.sistema_id limit 1
  ) v on true
  where e.client_id=p_cliente_id and e.ativo and e.deleted_at is null
  union all
  select 'grupo_quantitativo',g.id,g.nome,c.codigo,l.area_id,g.local_id,g.sistema_id,null
  from pcm.grupos_quantitativos g join pcm.locais l on l.id=g.local_id
  join pcm.areas a on a.id=l.area_id and a.cliente_id=p_cliente_id
  left join pcm.sso_codigos_grupo_quantitativo c on c.grupo_id=g.id and c.cliente_id=p_cliente_id and c.atual
  where g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null
   and l.ativo and l.deleted_at is null and a.ativo and a.deleted_at is null
 ), pagina as (
  select e.tipo||':'||e.id::text chave,e.* from entidades e
  where (nullif(p_tipo,'') is null or e.tipo=p_tipo)
   and (v_busca='' or position(v_busca in translate(lower(concat_ws(' ',e.nome,e.codigo)),
     'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'))>0)
   and (p_apos is null or (e.tipo||':'||e.id::text) collate "C">p_apos collate "C")
   and (p_contexto_tipo is null or
    (exists(select 1 from entidades contexto where contexto.tipo=p_contexto_tipo and contexto.id=p_contexto_id)
     and case p_contexto_tipo
      when 'area' then e.area_id=p_contexto_id and
       ((e.tipo='local' and e.parent_id is null) or (e.tipo not in ('area','local') and e.local_id is null))
      when 'local' then (e.tipo='local' and e.parent_id=p_contexto_id)
       or (e.tipo not in ('area','local') and e.local_id=p_contexto_id and e.parent_id is null)
      when 'sistema' then e.tipo in ('equipamento','componente','grupo_quantitativo') and e.sistema_id=p_contexto_id and e.parent_id is null
      when 'equipamento' then e.tipo in ('equipamento','componente') and e.parent_id=p_contexto_id
      when 'componente' then e.tipo in ('equipamento','componente') and e.parent_id=p_contexto_id
      else false end))
  order by (e.tipo||':'||e.id::text) collate "C" limit p_limite
 )
 select coalesce(jsonb_agg(to_jsonb(p) order by p.chave collate "C"),'[]'::jsonb) into v_resultado from pagina p;
 return v_resultado;
end $$;
revoke all on function pcm.sso_pesquisar_estrutura(uuid,text,text,text,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_pesquisar_estrutura(uuid,text,text,text,uuid,text,integer) to authenticated;

