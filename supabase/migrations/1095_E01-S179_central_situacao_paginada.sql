-- ADR-0938: consulta aditiva, dependente do gate existente e desligado.
create function pcm.sso_consultar_central_materiais_situacao(
  p_cliente_id uuid, p_ordem_servico_id uuid, p_responsavel text,
  p_estado text, p_limite integer, p_apos uuid
) returns table(id uuid, ordem_servico_id uuid, responsavel text, texto_original text, estado text, revisao integer)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100
    or (p_responsavel is not null and p_responsavel not in ('cliente', 'sinergica'))
    or (p_estado is not null and p_estado not in ('levantada', 'informada_disponivel', 'parcial', 'indisponivel')) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_central_materiais_mediada_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_central_materiais_mediada_gate g where g.id), false) then
    raise exception 'central_materiais_bloqueada' using errcode = '55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('material.gerir', p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select l.id, l.ordem_servico_id, l.responsavel, l.texto_original, l.estado, l.revisao
    from pcm.listas_materiais l join pcm.ordens_servico o
      on o.id = l.ordem_servico_id and o.client_id = l.cliente_id and o.deleted_at is null
    where l.cliente_id = p_cliente_id
      and (p_ordem_servico_id is null or l.ordem_servico_id = p_ordem_servico_id)
      and (p_responsavel is null or l.responsavel = p_responsavel)
      and (p_estado is null or l.estado = p_estado)
      and (p_apos is null or l.id > p_apos)
    order by l.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_consultar_central_materiais_situacao(uuid,uuid,text,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_central_materiais_situacao(uuid,uuid,text,text,integer,uuid) to authenticated;
