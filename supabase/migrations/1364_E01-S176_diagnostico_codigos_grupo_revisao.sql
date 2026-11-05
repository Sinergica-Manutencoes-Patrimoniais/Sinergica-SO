-- ADR-1209: diagnóstico de estágio por revisão, sem reservar ou atribuir código.
create function pcm.sso_diagnosticar_codigos_grupo_revisionado(p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid,p_revisao integer,p_apos text,p_limite integer)
returns table(chave text,informado boolean,sistemas_cliente bigint,componentes_cliente bigint,aliases_cliente bigint,outras_linhas_grupo bigint,revisao integer)
language plpgsql volatile security definer set search_path = '' as $$
declare v_lote pcm.sso_levantamentos%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_lote_id is null or p_revisao is null or p_revisao < 1
    or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos) > 200) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_diagnostico_codigos_grupo_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_lote.revisao <> p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  return query with grupos as materialized (
    select l.chave, nullif(btrim(l.atributos->>'codigoInformado'),'') as codigo from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.tipo='grupo_quantitativo'
  ) select g.chave, g.codigo is not null,
    (select count(*) from pcm.sistemas s where s.cliente_id=p_cliente_id and g.codigo is not null and upper(btrim(s.codigo))=upper(g.codigo)),
    (select count(*) from pcm.equipamentos e where e.client_id=p_cliente_id and g.codigo is not null and upper(btrim(e.identificador))=upper(g.codigo)),
    (select count(*) from pcm.sso_codigo_aliases a where a.cliente_id=p_cliente_id and g.codigo is not null and upper(btrim(a.codigo))=upper(g.codigo)),
    (select count(*) from grupos x where x.chave<>g.chave and g.codigo is not null and upper(x.codigo)=upper(g.codigo)), v_lote.revisao
    from grupos g where p_apos is null or g.chave collate "C">p_apos collate "C" order by g.chave collate "C" limit p_limite;
end; $$;
revoke all on function pcm.sso_diagnosticar_codigos_grupo_revisionado(uuid,uuid,uuid,integer,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_codigos_grupo_revisionado(uuid,uuid,uuid,integer,text,integer) to authenticated;
