-- ADR-1220: leitura pública mediada, núcleos permanecem privados.
create function pcm.sso_exigir_historico_materiais_portal(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.portal_material_visibilidade_gate where id and habilitado for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id
    where uc.user_id=p_ator_id and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico' for share of uc,u;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_historico_materiais_portal(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_portal_listas_historico_materiais_mediado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid)
returns table(lista_id uuid) language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_historico_materiais_portal(p_ator_id,p_cliente_id,p_os_id);
  return query select * from pcm.sso_portal_listas_historico_materiais(p_cliente_id,p_os_id,p_apos);
end; $$;
revoke all on function pcm.sso_portal_listas_historico_materiais_mediado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_listas_historico_materiais_mediado(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_portal_historico_materiais_mediado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_lista_id uuid,p_apos integer)
returns table(revisao_publicacao integer,publicado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
  if p_lista_id is null or p_apos is null or p_apos<0 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pcm.sso_exigir_historico_materiais_portal(p_ator_id,p_cliente_id,p_os_id);
  perform 1 from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id and ordem_servico_id=p_os_id for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select * from pcm.sso_portal_historico_materiais(p_cliente_id,p_os_id,p_lista_id,p_apos);
end; $$;
revoke all on function pcm.sso_portal_historico_materiais_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_historico_materiais_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_portal_versao_materiais_mediada(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_lista_id uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_linhas jsonb; v_publico jsonb;
begin
  if p_lista_id is null or p_revisao is null or p_revisao<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pcm.sso_exigir_historico_materiais_portal(p_ator_id,p_cliente_id,p_os_id);
  perform 1 from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id and ordem_servico_id=p_os_id for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_linhas:=pcm.sso_portal_versao_materiais(p_cliente_id,p_os_id,p_lista_id,p_revisao);
  if jsonb_typeof(v_linhas) is distinct from 'array' or jsonb_array_length(v_linhas)>100 then raise exception 'versao_indisponivel' using errcode='42501'; end if;
  if exists(select 1 from jsonb_array_elements(v_linhas) x where jsonb_typeof(x) is distinct from 'object'
    or jsonb_typeof(x->'descricao') is distinct from 'string'
    or coalesce(jsonb_typeof(x->'quantidade'),'null') not in ('string','null')
    or coalesce(jsonb_typeof(x->'unidade'),'null') not in ('string','null')) then raise exception 'versao_indisponivel' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('descricao',x->'descricao','quantidade',coalesce(x->'quantidade','null'::jsonb),'unidade',coalesce(x->'unidade','null'::jsonb)) order by n),'[]'::jsonb)
    into v_publico from jsonb_array_elements(v_linhas) with ordinality as a(x,n);
  return v_publico;
end; $$;
revoke all on function pcm.sso_portal_versao_materiais_mediada(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_versao_materiais_mediada(uuid,uuid,uuid,uuid,integer) to authenticated;
