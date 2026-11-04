-- ADR-0991: leitura privada por revisão, sem validar origem externa nem aprovar.
create table pcm.sso_diagnostico_hierarquia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_hierarquia_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_hierarquia_gate enable row level security;alter table pcm.sso_diagnostico_hierarquia_gate force row level security;
revoke all on pcm.sso_diagnostico_hierarquia_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnosticar_hierarquia_lote(p_cliente_id uuid,p_lote_id uuid,p_revision integer,p_apos text,p_limite integer)
returns table(chave text,tipo text,referencia_pai text,pai_tipo text,revisao integer,problemas text[])
language plpgsql volatile security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_diagnostico_hierarquia_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_lote_id is null or p_revision is null or p_revision<1
    or p_limite is null or p_limite not between 1 and 50 or (p_apos is not null and length(p_apos)>200)
    or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id for share;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_lote.revisao is distinct from p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  return query with recursive pagina as (
    select l.chave,l.tipo,nullif(btrim(l.atributos->>'referenciaPai'),'') as pai
    from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and (p_apos is null or l.chave collate "C">p_apos collate "C")
    order by l.chave collate "C" limit p_limite
  ), trilha(origem,chave,proximo,caminho,ciclo,profundidade) as (
    select p.chave,p.chave,p.pai,array[p.chave]::text[],false,1 from pagina p
    union all
    select t.origem,p.chave,nullif(btrim(p.atributos->>'referenciaPai'),''),t.caminho||p.chave,p.chave=any(t.caminho),t.profundidade+1
      from trilha t join pcm.sso_levantamento_linhas p on p.lote_id=p_lote_id and p.chave=t.proximo where not t.ciclo and t.profundidade<=1000
  ) select p.chave,p.tipo,p.pai,pt.tipo,v_lote.revisao,
    array_remove(array[
      case when p.tipo='area' and p.pai is not null then 'area_nao_admite_pai' end,
      case when p.pai is not null and pt.chave is null then 'pai_nao_encontrado_no_lote' end,
      case when exists(select 1 from trilha t where t.origem=p.chave and t.ciclo) then 'ciclo_hierarquia' end,
      case when exists(select 1 from trilha t where t.origem=p.chave and t.profundidade>1000) then 'cadeia_extensa' end,
      case when pt.chave is not null and p.tipo<>'area' and not ((p.tipo='local' and pt.tipo='area')
        or (p.tipo='sublocal' and pt.tipo in ('local','sublocal')) or (p.tipo='sistema' and pt.tipo in ('area','local','sublocal'))
        or (p.tipo in ('equipamento','grupo_quantitativo') and pt.tipo in ('local','sublocal'))
        or (p.tipo='componente' and pt.tipo in ('local','sublocal','equipamento'))) then 'tipo_pai_incompativel' end
    ]::text[],null)
    from pagina p left join pcm.sso_levantamento_linhas pt on pt.lote_id=p_lote_id and pt.chave=p.pai order by p.chave collate "C";
end; $$;
revoke all on function pcm.sso_diagnosticar_hierarquia_lote(uuid,uuid,integer,text,integer) from public,anon,authenticated,service_role;
