-- ADR-1203: histórico paginado, sem acesso direto à tabela.
create function pcm.sso_listar_historico_deslocamento(p_cliente_id uuid, p_visita_id uuid, p_apos integer default null, p_limite integer default 30)
returns table(revisao integer, revisao_visita integer, minutos_por_pessoa integer, pessoas_proprias integer,
  minutos_homem bigint, motivo text, ator_id uuid, criada_em timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null or (p_apos is not null and p_apos < 1)
    or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_deslocamento_declarado_gate where id and habilitado for share;
  if not found then raise exception 'deslocamento_bloqueado' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.visitas where id = p_visita_id and cliente_id = p_cliente_id for share;
  if not found then raise exception 'visita_indisponivel' using errcode = '42501'; end if;
  if exists (select 1 from pcm.sso_deslocamentos_declarados where visita_id = p_visita_id and cliente_id <> p_cliente_id) then
    raise exception 'historico_indisponivel' using errcode = '42501';
  end if;
  return query select d.revisao, d.revisao_visita, d.minutos_por_pessoa, d.pessoas_proprias,
    d.minutos_por_pessoa::bigint * d.pessoas_proprias::bigint, d.motivo, d.ator_id, d.criada_em
    from pcm.sso_deslocamentos_declarados d where d.cliente_id = p_cliente_id and d.visita_id = p_visita_id
      and (p_apos is null or d.revisao < p_apos) order by d.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_historico_deslocamento(uuid,uuid,integer,integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_historico_deslocamento(uuid,uuid,integer,integer) to authenticated;
