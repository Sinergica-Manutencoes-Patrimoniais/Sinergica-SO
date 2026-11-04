-- ADR-1460: acesso mediado ao registro de upload; não altera policies de Storage.
create function pcm.sso_listar_uploads_resposta_mediada(p_cliente_id uuid,p_retorno_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,resposta_id uuid,revisao integer,mime_declarado text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_uploads_evidencia_resposta(p_cliente_id,p_retorno_id,p_antes,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_uploads_resposta_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_uploads_resposta_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_resolver_upload_resposta_mediada(p_cliente_id uuid,p_retorno_id uuid,p_caminho text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_resultado boolean;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 if p_caminho is null or split_part(p_caminho,'/',1) is distinct from p_cliente_id::text or split_part(p_caminho,'/',2) is distinct from p_retorno_id::text then raise exception 'caminho_invalido' using errcode='22023'; end if;
 v_resultado:=pcm.sso_resolver_upload_evidencia_resposta(p_caminho);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_resolver_upload_resposta_mediada(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_upload_resposta_mediada(uuid,uuid,text) to authenticated;

create function pcm.sso_registrar_upload_resposta_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_expected_revision integer,p_resposta_id uuid,p_caminho text,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_registrar_upload_evidencia_resposta(p_request_id,p_cliente_id,p_retorno_id,p_expected_revision,p_resposta_id,p_caminho,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_registrar_upload_resposta_mediada(uuid,uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_upload_resposta_mediada(uuid,uuid,uuid,integer,uuid,text,text) to authenticated;
