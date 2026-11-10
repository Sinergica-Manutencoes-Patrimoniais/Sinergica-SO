-- ADR-1459: acesso mediado às referências privadas de fotos de retorno.
create function pcm.sso_listar_fotos_candidatas_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(nota_id uuid,criado_em timestamptz,mime_declarado text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_fotos_candidatas_retorno(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_fotos_candidatas_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_candidatas_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_fotos_referenciadas_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,nota_id uuid,mime_declarado text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_fotos_referenciadas_retorno(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_fotos_referenciadas_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_referenciadas_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_referenciar_foto_retorno_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_nota_id uuid,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_referenciar_foto_retorno(p_request_id,p_cliente_id,p_retorno_id,p_nota_id,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_referenciar_foto_retorno_mediada(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_referenciar_foto_retorno_mediada(uuid,uuid,uuid,uuid,text) to authenticated;

create function pcm.sso_listar_fotos_resposta_mediada(p_cliente_id uuid,p_retorno_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,resposta_id uuid,anexo_id uuid,revisao integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_fotos_por_resposta(p_cliente_id,p_retorno_id,p_antes,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_fotos_resposta_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_resposta_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_associar_foto_resposta_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_expected_revision integer,p_resposta_id uuid,p_anexo_id uuid,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_associar_foto_resposta(p_request_id,p_cliente_id,p_retorno_id,p_expected_revision,p_resposta_id,p_anexo_id,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_associar_foto_resposta_mediada(uuid,uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_associar_foto_resposta_mediada(uuid,uuid,uuid,integer,uuid,uuid,text) to authenticated;
