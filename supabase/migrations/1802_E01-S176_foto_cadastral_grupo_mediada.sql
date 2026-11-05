-- ADR-1660: leitura cadastral separada dos atestados; gate fechado.
create table pcm.sso_foto_cadastral_grupo_leitura_gate (
  id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into pcm.sso_foto_cadastral_grupo_leitura_gate(id,habilitado) values(true,false);
alter table pcm.sso_foto_cadastral_grupo_leitura_gate enable row level security;
alter table pcm.sso_foto_cadastral_grupo_leitura_gate force row level security;
revoke all on pcm.sso_foto_cadastral_grupo_leitura_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_fotos_cadastrais_grupo(p_ator uuid,p_cliente uuid,p_grupo uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is distinct from p_ator or p_ator is null or p_cliente is null or p_grupo is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_cadastral_grupo_leitura_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 perform 1 from pcm.sso_grupo_fotos_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente) is distinct from true and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.grupos_quantitativos g where g.id=p_grupo and g.cliente_id=p_cliente and g.ativo and g.deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select f.id,f.criado_em from pcm.sso_grupo_fotos f where f.grupo_id=p_grupo and f.cliente_id=p_cliente and (p_apos is null or f.id>p_apos) order by f.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_cadastrais_grupo(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_cadastrais_grupo(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_resolver_foto_cadastral_grupo_servico(p_ator uuid,p_cliente uuid,p_grupo uuid,p_foto uuid,p_papel text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text;v_claims text;v_sub text;v_resultado jsonb;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if p_ator is null or p_cliente is null or p_grupo is null or p_foto is null or p_papel is null or p_papel='' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_cadastral_grupo_leitura_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 perform 1 from pcm.sso_grupo_fotos_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 select u.papel into v_papel from config.usuarios u where u.user_id=p_ator and u.ativo;
 if v_papel is null or v_papel is distinct from p_papel then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_ator::text,'user_role',v_papel)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_ator::text,true);
 select jsonb_build_object('objetoId',o.id,'nome',o.name) into v_resultado
 from pcm.sso_grupo_fotos f join pcm.grupos_quantitativos g on g.id=f.grupo_id and g.cliente_id=f.cliente_id and g.ativo and g.deleted_at is null
 join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-grupos-fotos'
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 where f.id=p_foto and f.grupo_id=p_grupo and f.cliente_id=p_cliente
 and o.name like (p_cliente::text || '/' || p_grupo::text || '/%')
 and (config.sso_autorizar_acao('cadastro.ler',p_cliente) is true or config.sso_autorizar_acao('cadastro.gerir',p_cliente) is true);
 if v_resultado is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
 perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_resolver_foto_cadastral_grupo_servico(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_foto_cadastral_grupo_servico(uuid,uuid,uuid,uuid,text) to service_role;
