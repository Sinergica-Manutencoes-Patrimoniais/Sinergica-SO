-- ADR-1457: respostas e associações declaradas passam por autorização mediada.
create function pcm.sso_listar_respostas_retorno_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,chave_pergunta text,resultado text,observacao text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_respostas_retorno(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_respostas_retorno_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_respostas_retorno_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_evidencias_resposta_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,resposta_id uuid,evidencia_id uuid,revisao_evidencias integer,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_evidencias_por_resposta(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_evidencias_resposta_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_evidencias_resposta_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_prever_evidencias_resposta_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(resposta_id uuid,chave_pergunta text,resultado text,evidencias_declaradas bigint,estado text,evidencia_autenticada boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_prever_evidencias_respostas(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_prever_evidencias_resposta_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_evidencias_resposta_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_vincular_evidencia_resposta_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_evidencia_id uuid,p_expected_evidencias integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_vincular_evidencia_resposta(p_request_id,p_cliente_id,p_retorno_id,p_resposta_id,p_evidencia_id,p_expected_evidencias,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_vincular_evidencia_resposta_mediada(uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_evidencia_resposta_mediada(uuid,uuid,uuid,uuid,uuid,integer,text) to authenticated;
