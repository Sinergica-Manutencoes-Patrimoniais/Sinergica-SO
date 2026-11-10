-- ADR-1308: entradas mediadas; gate do núcleo permanece fechado.
create function pcm.sso_historico_exigencia_rotina_mediado(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,revisao integer,classificacao text,referencia text,justificativa text,ator_id uuid,criado_em timestamptz,modo text,tolerancia_antes integer,tolerancia_depois integer)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_exigencia_legal_gate where id and habilitado for share;
 if not found then raise exception 'exigencia_bloqueada' using errcode='55000'; end if;
 return query select * from pcm.sso_historico_exigencia_rotina(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_antes,p_limite);
end; $$;
revoke all on function pcm.sso_historico_exigencia_rotina_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_exigencia_rotina_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_declarar_exigencia_rotina_mediado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_plano integer,p_expected_declaracao integer,p_classificacao text,p_referencia text,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_exigencia_legal_gate where id and habilitado for share;
 if not found then raise exception 'exigencia_bloqueada' using errcode='55000'; end if;
 return pcm.sso_declarar_exigencia_rotina(p_request_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_plano,p_expected_declaracao,p_classificacao,p_referencia,p_justificativa);
end; $$;
revoke all on function pcm.sso_declarar_exigencia_rotina_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_exigencia_rotina_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) to authenticated;
