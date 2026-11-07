-- ADR-0177: consulta fechada; não grava cadastros.
create function pcm.sso_diagnosticar_linhas_levantamento(p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo text,problemas text[],possiveis_duplicatas bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_lote_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos)>200) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query with recursive base as (
    select l.chave,l.tipo,l.atributos,nullif(btrim(l.atributos->>'nome'),'') nome,
      nullif(btrim(l.atributos->>'codigoInformado'),'') codigo,nullif(btrim(l.atributos->>'referenciaPai'),'') pai
    from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id
  ), caminhos as (
    select b.chave origem,b.chave atual,b.pai,array[b.chave]::text[] trilha,0 profundidade,false ciclo from base b
    union all
    select c.origem,p.chave,p.pai,c.trilha || p.chave,c.profundidade+1,p.chave=any(c.trilha)
      from caminhos c join base p on p.chave=c.pai where not c.ciclo and c.profundidade<100
  ), dados as (
    select b.*,
      case b.tipo
        when 'area' then (select count(*) from pcm.areas a where a.cliente_id=v_cliente and a.deleted_at is null and lower(btrim(a.nome))=lower(b.nome))
        when 'local' then (select count(*) from pcm.locais l join pcm.areas a on a.id=l.area_id where a.cliente_id=v_cliente and l.deleted_at is null and lower(btrim(l.nome))=lower(b.nome))
        when 'sublocal' then (select count(*) from pcm.locais l join pcm.areas a on a.id=l.area_id where a.cliente_id=v_cliente and l.deleted_at is null and lower(btrim(l.nome))=lower(b.nome))
        when 'sistema' then (select count(*) from pcm.sistemas s where s.cliente_id=v_cliente and s.deleted_at is null and lower(btrim(s.nome))=lower(b.nome))
        when 'grupo_quantitativo' then (select count(*) from pcm.grupos_quantitativos g where g.cliente_id=v_cliente and g.deleted_at is null and lower(btrim(g.nome))=lower(b.nome))
        else (select count(*) from pcm.equipamentos e where e.client_id=v_cliente and e.deleted_at is null and e.tipo=b.tipo and lower(btrim(e.nome))=lower(b.nome)) end dup
    from base b
  ) select d.chave,d.tipo,array_remove(array[
    case when d.nome is null then 'nome_ausente' end,
    case when d.codigo is not null and (length(d.codigo)>200 or d.codigo<>upper(d.codigo) or d.codigo~'[[:space:]]') then 'codigo_formato_invalido' end,
    case when d.codigo is not null and (exists(select 1 from pcm.sistemas s where s.cliente_id=v_cliente and upper(btrim(s.codigo))=upper(d.codigo))
      or exists(select 1 from pcm.equipamentos e where e.client_id=v_cliente and upper(btrim(e.identificador))=upper(d.codigo))
      or exists(select 1 from pcm.sso_codigo_aliases a where a.cliente_id=v_cliente and upper(btrim(a.codigo))=upper(d.codigo))) then 'codigo_ja_utilizado_no_cliente' end,
    case when d.tipo in ('local','sublocal') and d.pai is null then 'pai_ausente' end,
    case when d.tipo='area' and d.pai is not null then 'area_nao_admite_pai' end,
    case when d.pai is not null and not exists(select 1 from base p where p.chave=d.pai) then 'pai_nao_encontrado_no_lote' end,
    case when d.pai is not null and exists(select 1 from base p where p.chave=d.pai and not (
      (d.tipo='local' and p.tipo='area') or (d.tipo='sublocal' and p.tipo in ('local','sublocal'))
      or (d.tipo='sistema' and p.tipo in ('area','local','sublocal'))
      or (d.tipo in ('equipamento','grupo_quantitativo') and p.tipo in ('local','sublocal'))
      or (d.tipo='componente' and p.tipo in ('local','sublocal','equipamento')))) then 'tipo_pai_incompativel' end,
    case when exists(select 1 from caminhos c where c.origem=d.chave and (c.ciclo or (c.profundidade=100 and c.pai is not null))) then 'ciclo_ou_profundidade_excessiva' end,
    case when exists(select 1 from base b where b.chave<>d.chave and b.tipo=d.tipo and b.nome is not null and lower(b.nome)=lower(d.nome)) then 'nome_repetido_no_lote' end
  ],null),d.dup from dados d where p_apos is null or d.chave>p_apos order by d.chave limit p_limite;
end;
$$;
revoke all on function pcm.sso_diagnosticar_linhas_levantamento(uuid,text,integer) from public,anon,authenticated,service_role;
