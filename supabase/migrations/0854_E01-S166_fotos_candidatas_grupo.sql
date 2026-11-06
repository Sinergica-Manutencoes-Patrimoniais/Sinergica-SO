-- ADR-0629: seleção somente de fotos privadas realmente vinculadas à OS declarada.
create function pcm.sso_listar_fotos_candidatas_grupo(p_cliente_id uuid,p_ocorrencia_id uuid,p_apos uuid,p_limite integer)
returns table(nota_id uuid,os_id uuid,mime_declarado text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_foto_grupo_gate where id),false) then raise exception 'foto_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select n.id,os.id,o.metadata->>'mimetype',n.created_at from pcm.sso_vinculos_os_grupo v
 join pcm.ordens_servico os on os.id=v.os_id and os.client_id=v.cliente_id and os.deleted_at is null
 join pcm.os_notas n on n.ordem_servico_id=os.id and n.cliente_id=v.cliente_id
 join storage.objects o on o.name=n.anexo_path and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=v.cliente_id::text and o.metadata->>'mimetype' in ('image/jpeg','image/png')
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 where v.cliente_id=p_cliente_id and v.ocorrencia_grupo_id=p_ocorrencia_id and (p_apos is null or n.id>p_apos) order by n.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_candidatas_grupo(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
