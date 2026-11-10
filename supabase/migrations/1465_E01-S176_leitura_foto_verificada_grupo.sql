-- ADR-1318: leitura de vínculo com digest; caminho somente ao serviço.
create function pcm.sso_listar_fotos_verificadas_grupo(
 p_ator_id uuid,p_cliente_id uuid,p_grupo_id uuid,p_apos uuid,p_limite integer
) returns table(id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_grupo_id is null
   or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_verificada_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 perform 1 from pcm.sso_ingestao_foto_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 perform 1 from pcm.sso_fotos_levantamento_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is distinct from true
   and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select v.id,v.criado_em from pcm.sso_foto_verificada_grupo v
   join pcm.sso_fotos_levantamento f on f.id=v.foto_id and f.cliente_id=v.cliente_id
   join pcm.sso_ingestao_foto_reservas r on r.foto_id=f.id and r.cliente_id=f.cliente_id and r.objeto_id=f.objeto_id and r.confirmado_em is not null
   join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=f.id order by d.revisao desc limit 1) u on u.decisao='aceita'
   where v.grupo_id=p_grupo_id and v.cliente_id=p_cliente_id and (p_apos is null or v.id>p_apos)
     and not pcm.sso_foto_inadequada(f.id) and not exists(select 1 from pcm.sso_retiradas_anexo a where a.tipo='foto' and a.anexo_id=f.id)
   order by v.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_verificadas_grupo(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_verificadas_grupo(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_resolver_foto_verificada_grupo_servico(p_usuario_id uuid,p_vinculo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text;v_claims text;v_sub text;v_resultado jsonb;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if p_usuario_id is null or p_vinculo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_verificada_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 perform 1 from pcm.sso_ingestao_foto_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 perform 1 from pcm.sso_fotos_levantamento_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 select u.papel into v_papel from config.usuarios u where u.user_id=p_usuario_id and u.ativo;
 if v_papel is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',v_papel)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 select jsonb_build_object('objetoId',o.id,'nome',o.name,'digest',r.digest) into v_resultado
   from pcm.sso_foto_verificada_grupo v
   join pcm.grupos_quantitativos g on g.id=v.grupo_id and g.cliente_id=v.cliente_id and g.ativo and g.deleted_at is null
   join pcm.sso_fotos_levantamento f on f.id=v.foto_id and f.cliente_id=v.cliente_id
   join pcm.sso_ingestao_foto_reservas r on r.foto_id=f.id and r.cliente_id=f.cliente_id and r.objeto_id=f.objeto_id and r.confirmado_em is not null
   join storage.objects o on o.id=r.objeto_id and o.name=r.nome and o.bucket_id='sso-levantamento-fotos'
   join storage.buckets b on b.id=o.bucket_id and b.public is false
   join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=f.id order by d.revisao desc limit 1) u on u.decisao='aceita'
   where v.id=p_vinculo_id and (config.sso_autorizar_acao('cadastro.ler',v.cliente_id) is true or config.sso_autorizar_acao('cadastro.gerir',v.cliente_id) is true)
     and not pcm.sso_foto_inadequada(f.id) and not exists(select 1 from pcm.sso_retiradas_anexo a where a.tipo='foto' and a.anexo_id=f.id);
 if v_resultado is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
 perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_resolver_foto_verificada_grupo_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_foto_verificada_grupo_servico(uuid,uuid) to service_role;
