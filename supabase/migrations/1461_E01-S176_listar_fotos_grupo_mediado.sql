-- ADR-1314: lista identificadores aceitos; não expõe caminhos ou arquivos.
create function pcm.sso_listar_fotos_staging_grupo_mediado(
 p_ator_id uuid,p_cliente_id uuid,p_grupo_id uuid,p_apos uuid,p_limite integer
) returns table(id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_grupo_id is null
   or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_staging_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 perform 1 from pcm.sso_fotos_levantamento_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is distinct from true
   and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_fotos_staging_grupo(p_grupo_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_fotos_staging_grupo_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_staging_grupo_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;
