-- ADR-0879: entrada autenticada para a transição local; gate existente permanece fechado.
create function pcm.sso_transicionar_visita_mediada(
  p_request_id uuid,p_visita_id uuid,p_expected_revision integer,
  p_acao text,p_inicio timestamptz,p_fim timestamptz,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin
  if not coalesce((select g.habilitado from pcm.visita_transicao_gate g where g.id),false) then
    raise exception 'transicao_visita_bloqueada' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.visita_transicao_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.visita_transicao_gate g where g.id),false) then
    raise exception 'transicao_visita_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501';
  end if;
  return pcm.sso_transicionar_visita_preparada(p_request_id,p_visita_id,p_expected_revision,p_acao,p_inicio,p_fim,p_motivo);
end;
$$;
revoke all on function pcm.sso_transicionar_visita_mediada(uuid,uuid,integer,text,timestamptz,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_transicionar_visita_mediada(uuid,uuid,integer,text,timestamptz,timestamptz,text) to authenticated;
