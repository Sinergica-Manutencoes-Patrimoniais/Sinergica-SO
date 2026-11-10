-- ADR-1461: entradas autenticadas para proposta e decisão de reclassificação.
create function pcm.sso_guardar_reclassificacao_mediada(p_cliente_id uuid,p_resposta_id uuid,p_escrita boolean)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_retorno uuid;
begin
 select r.retorno_id into v_retorno from pcm.respostas_os_preparadas r join pcm.retorno_os_preparado ret on ret.id=r.retorno_id and ret.cliente_id=p_cliente_id where r.id=p_resposta_id;
 if v_retorno is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,v_retorno,p_escrita);
 return v_retorno;
end; $$;
revoke all on function pcm.sso_guardar_reclassificacao_mediada(uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_contexto_reclassificacao_mediada(p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if pcm.sso_guardar_reclassificacao_mediada(p_cliente_id,p_resposta_id,false) is distinct from p_retorno_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_contexto_reclassificacao(p_cliente_id,p_retorno_id,p_resposta_id);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;return v_resultado;
end; $$;
revoke all on function pcm.sso_contexto_reclassificacao_mediada(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_contexto_reclassificacao_mediada(uuid,uuid,uuid) to authenticated;

create function pcm.sso_previa_reclassificacao_mediada(p_cliente_id uuid,p_resposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_reclassificacao_mediada(p_cliente_id,p_resposta_id,false);
 v_resultado:=pcm.sso_previa_resposta_reclassificada(p_cliente_id,p_resposta_id);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;return v_resultado;
end; $$;
revoke all on function pcm.sso_previa_reclassificacao_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_previa_reclassificacao_mediada(uuid,uuid) to authenticated;

create function pcm.sso_historico_reclassificacao_mediada(p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,tipo text,revisao integer,resultado text,observacao text,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if pcm.sso_guardar_reclassificacao_mediada(p_cliente_id,p_resposta_id,false) is distinct from p_retorno_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_historico_reclassificacao(p_cliente_id,p_retorno_id,p_resposta_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_historico_reclassificacao_mediada(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_reclassificacao_mediada(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_propor_reclassificacao_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_expected_revision integer,p_expected_validacao integer,p_resultado text,p_observacao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if pcm.sso_guardar_reclassificacao_mediada(p_cliente_id,p_resposta_id,true) is distinct from p_retorno_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_propor_reclassificacao_resposta(p_request_id,p_cliente_id,p_retorno_id,p_resposta_id,p_expected_revision,p_expected_validacao,p_resultado,p_observacao,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;return v_resultado;
end; $$;
revoke all on function pcm.sso_propor_reclassificacao_mediada(uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_propor_reclassificacao_mediada(uuid,uuid,uuid,uuid,integer,integer,text,text,text) to authenticated;

create function pcm.sso_decidir_reclassificacao_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_proposta_id uuid,p_expected_decisao integer,p_expected_validacao integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_decidir_proposta_resposta(p_request_id,p_cliente_id,p_retorno_id,p_proposta_id,p_expected_decisao,p_expected_validacao,p_decisao,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_reclassificacao_mediada(uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_reclassificacao_mediada(uuid,uuid,uuid,uuid,integer,integer,text,text) to authenticated;

create function pcm.sso_reabrir_reclassificacao_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_expected_revision integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_reabrir_retorno_para_reclassificacao(p_request_id,p_cliente_id,p_retorno_id,p_expected_revision,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;return v_resultado;
end; $$;
revoke all on function pcm.sso_reabrir_reclassificacao_mediada(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reabrir_reclassificacao_mediada(uuid,uuid,uuid,integer,text) to authenticated;
