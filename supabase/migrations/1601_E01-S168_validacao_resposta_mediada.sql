-- ADR-1458: decisão por resposta via entrada autenticada.
create function pcm.sso_listar_validacoes_resposta_mediada(p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,evidencia_id uuid,revisao integer,revisao_uploads integer,decisao text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_validacoes_resposta(p_cliente_id,p_retorno_id,p_resposta_id,p_antes,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_validacoes_resposta_mediada(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_validacoes_resposta_mediada(uuid,uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_validar_resposta_evidencia_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_evidencia_id uuid,p_expected_decisao integer,p_expected_uploads integer,p_decisao text,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_validar_resposta_evidencia(p_request_id,p_cliente_id,p_retorno_id,p_resposta_id,p_evidencia_id,p_expected_decisao,p_expected_uploads,p_decisao,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_validar_resposta_evidencia_mediada(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_validar_resposta_evidencia_mediada(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) to authenticated;
