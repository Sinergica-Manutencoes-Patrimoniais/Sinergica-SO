-- ADR-1454: mediação para conferência, reconciliação e reatestação.
create function pcm.sso_listar_conferencias_cobertura_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,evidencia_id uuid,revisao_evidencias integer,perguntas integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_conferencias_cobertura_retorno(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_conferencias_cobertura_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_conferencias_cobertura_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_conferir_cobertura_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_evidencia_id uuid,p_expected_evidencias integer,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_conferir_cobertura_retorno(p_request_id,p_cliente_id,p_retorno_id,p_evidencia_id,p_expected_evidencias,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_conferir_cobertura_mediada(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferir_cobertura_mediada(uuid,uuid,uuid,uuid,integer,text) to authenticated;

create function pcm.sso_reconciliar_cobertura_mediada(p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 v_resultado:=pcm.sso_reconciliar_cobertura_validacao(p_cliente_id,p_retorno_id,p_conferencia_id);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_reconciliar_cobertura_mediada(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliar_cobertura_mediada(uuid,uuid,uuid) to authenticated;

create function pcm.sso_listar_reatestacoes_mediada(p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,conferencia_nova_id uuid,revisao_decisao integer,revisao_evidencias integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_reatestacoes_retorno(p_cliente_id,p_retorno_id,p_conferencia_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_reatestacoes_mediada(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_reatestacoes_mediada(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_reatestar_cobertura_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_reatestar_cobertura_retorno(p_request_id,p_cliente_id,p_retorno_id,p_conferencia_id,p_expected_evidencias,p_expected_decisao,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_reatestar_cobertura_mediada(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reatestar_cobertura_mediada(uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
