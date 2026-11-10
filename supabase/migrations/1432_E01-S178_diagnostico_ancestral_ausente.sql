-- ADR-1285: versão aditiva, sem modificar o contrato anterior ou a estrutura oficial.
create function pcm.sso_diagnosticar_hierarquia_lote_v2(
  p_ator_id uuid, p_cliente_id uuid, p_lote_id uuid, p_revision integer,
  p_apos text, p_limite integer
) returns table(chave text, tipo text, referencia_pai text, pai_tipo text, revisao integer, problemas text[])
language sql volatile security definer set search_path = '' as $$
  with recursive pagina as materialized (
    select * from pcm.sso_diagnosticar_hierarquia_lote_mediado(
      p_ator_id, p_cliente_id, p_lote_id, p_revision, p_apos, p_limite)
  ), trilha(origem, proximo, caminho, profundidade) as (
    select p.chave, p.referencia_pai, array[p.chave]::text[], 1 from pagina p
    union all
    select t.origem, nullif(btrim(l.atributos->>'referenciaPai'), ''),
      t.caminho || l.chave, t.profundidade + 1
    from trilha t
    join pcm.sso_levantamento_linhas l on l.lote_id = p_lote_id and l.chave = t.proximo
    where t.profundidade <= 1000 and not l.chave = any(t.caminho)
  )
  select p.chave, p.tipo, p.referencia_pai, p.pai_tipo, p.revisao,
    case when exists (
      select 1 from trilha t
      where t.origem = p.chave and t.profundidade > 1 and t.proximo is not null
        and not exists (select 1 from pcm.sso_levantamento_linhas l
          where l.lote_id = p_lote_id and l.chave = t.proximo)
    ) then array_append(p.problemas, 'ancestral_nao_encontrado_no_lote')
    else p.problemas end
  from pagina p order by p.chave collate "C";
$$;
revoke all on function pcm.sso_diagnosticar_hierarquia_lote_v2(uuid,uuid,uuid,integer,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_hierarquia_lote_v2(uuid,uuid,uuid,integer,text,integer) to authenticated;
