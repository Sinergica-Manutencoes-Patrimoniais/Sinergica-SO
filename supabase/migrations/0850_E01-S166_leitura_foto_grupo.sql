-- ADR-0625: metadados autorizados e resolvedor privado apenas para serviço.
create function pcm.sso_listar_fotos_atestado_grupo(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,atestado_request_id uuid,nota_id uuid,revisao integer,mime_declarado text,justificativa text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_foto_grupo_gate where id),false) then raise exception 'foto_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select f.id,f.atestado_request_id,f.nota_id,f.revisao,f.mime_declarado,f.justificativa,f.criado_em from pcm.sso_fotos_atestado_grupo f where f.cliente_id=p_cliente_id and f.ocorrencia_id=p_ocorrencia_id and (p_antes is null or f.revisao<p_antes) order by f.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_atestado_grupo(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_foto_grupo_servico(p_foto_id uuid,p_usuario_id uuid,p_user_role text)
returns text language plpgsql security definer set search_path='' as $$
declare v_nome text;v_claims text;v_sub text;
begin
 if p_foto_id is null or p_usuario_id is null or p_user_role is null or length(p_user_role) not between 1 and 100 or not coalesce((select habilitado from pcm.sso_foto_grupo_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',p_user_role)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 select obj.name into v_nome from pcm.sso_fotos_atestado_grupo f
 join pcm.sso_atestados_declarados_grupo a on a.request_id=f.atestado_request_id and a.ocorrencia_id=f.ocorrencia_id and a.cliente_id=f.cliente_id and a.os_id=f.os_id
 join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=f.ocorrencia_id and v.cliente_id=f.cliente_id and v.os_id=f.os_id
 join pcm.ordens_servico os on os.id=f.os_id and os.client_id=f.cliente_id and os.deleted_at is null
 join pcm.os_notas n on n.id=f.nota_id and n.ordem_servico_id=os.id and n.cliente_id=f.cliente_id
 join storage.objects obj on obj.id=f.objeto_id and obj.name=n.anexo_path and obj.bucket_id='os-anexos' and split_part(obj.name,'/',1)=f.cliente_id::text and obj.metadata->>'mimetype'=f.mime_declarado
 join storage.buckets b on b.id=obj.bucket_id and b.public is false
 where f.id=p_foto_id and config.sso_autorizar_acao('execucao.validar',f.cliente_id) is true;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 if v_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;return v_nome;
end; $$;
revoke all on function pcm.sso_foto_grupo_servico(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_foto_grupo_servico(uuid,uuid,text) to service_role;
