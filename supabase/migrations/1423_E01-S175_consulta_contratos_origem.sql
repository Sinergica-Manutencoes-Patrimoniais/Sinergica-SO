-- ADR-1275: leitura e comandos ainda dependem de gate fechado.
create function pcm.sso_listar_contratos_origem(p_ator_id uuid,p_apos uuid default null,p_limite integer default 20)
returns table(id uuid,versao text,habilitado boolean,definicao jsonb,motivo text,evidencia text,criado_por uuid)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_contrato_origem_admin_gate where pcm.sso_contrato_origem_admin_gate.id and pcm.sso_contrato_origem_admin_gate.habilitado for share;
  if not found then raise exception 'administracao_desabilitada' using errcode='55000'; end if;
  if coalesce(auth.jwt()->>'user_role','')<>'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.id,c.versao,c.habilitado,c.definicao,c.motivo,c.evidencia,c.criado_por
    from pcm.sso_contratos_origem_campo c where p_apos is null or c.id>p_apos order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_contratos_origem(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_contratos_origem(uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_cadastrar_contrato_origem(uuid,uuid,uuid,text,jsonb,text,text) to authenticated;
grant execute on function pcm.sso_alterar_contrato_origem(uuid,uuid,uuid,boolean,boolean,text) to authenticated;
