-- ADR-1131: consulta administrativa sem alterar gate de observação.
create function pcm.sso_consultar_limite_demora(p_ator_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_config pcm.sso_demora_fila_config%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_config_demora_gate where id and habilitado for share;
 if not found then raise exception 'configuracao_desabilitada' using errcode='55000'; end if;
 if coalesce(auth.jwt()->>'user_role','')<>'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_config from pcm.sso_demora_fila_config where id for share;
 if not found then raise exception 'configuracao_indisponivel' using errcode='55000'; end if;
 if not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('revision',v_config.revisao,'limiteMinutos',v_config.limite_minutos,'observacaoAtivada',v_config.habilitado);
end; $$;
revoke all on function pcm.sso_consultar_limite_demora(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_limite_demora(uuid) to authenticated;
grant execute on function pcm.sso_configurar_limite_demora(uuid,uuid,integer,integer,text) to authenticated;
