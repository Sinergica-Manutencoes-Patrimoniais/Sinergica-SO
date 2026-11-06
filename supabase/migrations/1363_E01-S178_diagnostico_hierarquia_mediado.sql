-- ADR-1208: mediação sem acesso direto ao núcleo ou à estrutura oficial.
create function pcm.sso_diagnosticar_hierarquia_lote_mediado(p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid,p_revision integer,p_apos text,p_limite integer)
returns table(chave text,tipo text,referencia_pai text,pai_tipo text,revisao integer,problemas text[])
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_lote_id is null
    or p_revision is null or p_revision < 1 or p_limite is null or p_limite not between 1 and 50
    or (p_apos is not null and length(p_apos) > 200) then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  return query select * from pcm.sso_diagnosticar_hierarquia_lote(p_cliente_id,p_lote_id,p_revision,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_diagnosticar_hierarquia_lote_mediado(uuid,uuid,uuid,integer,text,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_hierarquia_lote_mediado(uuid,uuid,uuid,integer,text,integer) to authenticated;
