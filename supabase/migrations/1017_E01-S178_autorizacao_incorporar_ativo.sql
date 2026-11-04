-- ADR-0828: preserva contrato, ACL e gates existentes.
create or replace function pcm.sso_incorporar_ativo_autorizado(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_local_id uuid,p_categoria_id uuid,p_sistema_id uuid,p_parent_id uuid,p_codigo text,p_quantidade bigint,p_codigo_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_mediacao_conferencia_gate where id for share;
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return pcm.sso_incorporar_ativo_codigo_staging(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade,p_codigo_revision);
end;$$;
