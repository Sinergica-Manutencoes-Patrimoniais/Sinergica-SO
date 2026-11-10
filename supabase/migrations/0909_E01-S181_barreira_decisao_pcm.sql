-- ADR-0684: bloquear decisão PCM enquanto status aceito não distingue sua origem.
alter function comercial.sso_decidir_orcamento_pcm(uuid,uuid,uuid,uuid,integer,text,text,text) rename to sso_decidir_orcamento_pcm_base_0909;
revoke all on function comercial.sso_decidir_orcamento_pcm_base_0909(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
create function comercial.sso_decidir_orcamento_pcm(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer,p_decisao text,p_motivo text,p_evidencia text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 raise exception 'decisao_pcm_bloqueada_distincao_aceite_pendente' using errcode='55000';
end $$;
revoke all on function comercial.sso_decidir_orcamento_pcm(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
