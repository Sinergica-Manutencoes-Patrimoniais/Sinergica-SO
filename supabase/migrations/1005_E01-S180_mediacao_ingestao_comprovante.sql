-- ADR-0806: somente mediação de serviço; gates da 1003 continuam fechados.
-- SQL não verifica bytes; identidade e digest devem vir de Edge autenticado confiável.
create function pcm.sso_ingestao_comprovante_servico(p_operacao text,p_usuario_id uuid,p_request_id uuid,p_despesa_id uuid,p_digest text,p_objeto_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'sem_acesso' using errcode='42501'; end if;
 return pcm.sso_ingestao_comprovante_interno(p_operacao,p_usuario_id,p_request_id,p_despesa_id,p_digest,p_objeto_id);
end $$;
revoke all on function pcm.sso_ingestao_comprovante_servico(text,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_ingestao_comprovante_servico(text,uuid,uuid,uuid,text,uuid) to service_role;
