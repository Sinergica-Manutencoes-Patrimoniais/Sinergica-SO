-- ADR-0317: resolver privado chamado pela rota autenticada; não ativar sem revisão.
create function pcm.sso_foto_retorno_autorizada(p_anexo_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
 if auth.uid() is null or p_anexo_id is null or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_retorno_gate where id),false) then raise exception 'anexo_indisponivel' using errcode='42501'; end if;
 select o.name into v_nome from pcm.sso_anexos_retorno_privados a
 join pcm.retorno_os_preparado r on r.id=a.retorno_id
 join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null
 join pcm.os_notas n on n.id=a.nota_id and n.ordem_servico_id=os.id and n.cliente_id=r.cliente_id and n.anexo_path=a.caminho
 join storage.objects o on o.id=a.objeto_id and o.name=a.caminho and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=r.cliente_id::text and o.metadata->>'mimetype'=a.mime_declarado
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 where a.id=p_anexo_id and config.sso_autorizar_acao('execucao.validar',r.cliente_id) is true;
 if v_nome is null then raise exception 'anexo_indisponivel' using errcode='42501'; end if;
 return v_nome;
end; $$;
revoke all on function pcm.sso_foto_retorno_autorizada(uuid) from public,anon,authenticated,service_role;
