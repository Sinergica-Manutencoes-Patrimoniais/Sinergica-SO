-- ADR-1453: perguntas, diagnóstico e registro usam o mesmo contrato de acesso.
create function pcm.sso_checar_obrigatorias_mediada(p_cliente_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 v_resultado:=pcm.sso_checar_obrigatorias_retorno(p_cliente_id,p_retorno_id);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_checar_obrigatorias_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_checar_obrigatorias_mediada(uuid,uuid) to authenticated;

create function pcm.sso_prever_perguntas_contrato_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos integer,p_limite integer)
returns table(indice integer,pergunta_id text,obrigatoriedade text,resposta_id uuid,resultado text,decisao_pcm text,revisao_uploads_decisao integer,revisao_uploads_atual integer,estado text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_prever_cobertura_perguntas_contrato(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_prever_perguntas_contrato_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_perguntas_contrato_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_registrar_condicao_estrutural_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_registrar_condicao_estrutural_retorno(p_request_id,p_cliente_id,p_retorno_id,p_conferencia_id,p_expected_evidencias,p_expected_decisao,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_registrar_condicao_estrutural_mediada(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_condicao_estrutural_mediada(uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
