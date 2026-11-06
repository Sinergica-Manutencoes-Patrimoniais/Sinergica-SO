-- ADR-0770: somente o serviço confiável pode localizar o objeto pendente.
create function pcm.sso_recuperar_objeto_ingestao_servico(p_usuario_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text,p_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_res pcm.sso_ingestao_foto_reservas%rowtype;v_objeto uuid;
begin
  perform pcm.sso_ingestao_foto_servico('autorizar',p_usuario_id,null,p_lote_id,p_chave,null,null);
  select r.* into v_res from pcm.sso_ingestao_foto_reservas r where r.request_id=p_request_id and r.ator_id=p_usuario_id and r.lote_id=p_lote_id and r.linha_chave=p_chave and r.digest=p_digest;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select o.id into v_objeto from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false where o.bucket_id='sso-levantamento-fotos' and o.name=v_res.nome;
  if v_objeto is null then return null; end if;
  if v_res.objeto_id is not null and v_res.objeto_id is distinct from v_objeto then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('objetoId',v_objeto,'nome',v_res.nome);
end; $$;
revoke all on function pcm.sso_recuperar_objeto_ingestao_servico(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recuperar_objeto_ingestao_servico(uuid,uuid,uuid,text,text) to service_role;
