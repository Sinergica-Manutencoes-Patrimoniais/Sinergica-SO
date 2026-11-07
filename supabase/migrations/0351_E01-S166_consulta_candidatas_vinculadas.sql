-- ADR-0126: leitura preparada; não substitui a fila oficial nem libera execução.
create function pcm.sso_listar_candidatas_ocorrencias_vinculadas(
  p_cliente_id uuid,
  p_ate date,
  p_cursor_vencimento date default null,
  p_cursor_id uuid default null,
  p_limite integer default 50
) returns table (
  ocorrencia_preparada_id uuid,
  ocorrencia_legada_id uuid,
  ciclo_id uuid,
  plano_id uuid,
  versao_id uuid,
  rotina_id uuid,
  alvo_tipo text,
  alvo_id uuid,
  vencimento_original date,
  tolerancia_antes integer,
  tolerancia_depois integer
)
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id), false) then
    raise exception 'materializacao_bloqueada' using errcode = '55000';
  end if;
  if auth.uid() is null or p_cliente_id is null or p_ate is null
     or not isfinite(p_ate) or p_limite is null or p_limite not between 1 and 100
     or ((p_cursor_vencimento is null) <> (p_cursor_id is null))
     or (p_cursor_vencimento is not null and not isfinite(p_cursor_vencimento)) then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;

  return query
    select prep.id, leg.id, vinc.ciclo_id, prep.plano_id, prep.versao_id,
      prep.rotina_id, prep.alvo_tipo, prep.alvo_id, prep.vencimento_original,
      prep.tolerancia_antes, prep.tolerancia_depois
    from pcm.ocorrencias_rotina_preparadas prep
    join pcm.planos_manutencao plano on plano.id = prep.plano_id
    join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_preparada_id = prep.id
    join pcm.ocorrencias_preventivas leg on leg.id = vinc.ocorrencia_legada_id
    join pcm.planos_preventivos legado on legado.id = leg.plano_id
    where plano.cliente_id = p_cliente_id and legado.cliente_id = p_cliente_id
      and prep.vencimento_original = leg.vencimento
      and ((prep.alvo_tipo = 'sistema' and legado.sistema_id = prep.alvo_id)
        or (prep.alvo_tipo = 'componente' and legado.equipamento_id = prep.alvo_id))
      and leg.envio_estado = 'prevista' and leg.auvo_task_id is null
      and leg.resultado_estado = 'pendente'
      and not exists (select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id = leg.id)
      and prep.vencimento_original <= p_ate
      and (p_cursor_id is null or (prep.vencimento_original, prep.id) > (p_cursor_vencimento, p_cursor_id))
    order by prep.vencimento_original, prep.id
    limit p_limite;
end;
$$;

revoke all on function pcm.sso_listar_candidatas_ocorrencias_vinculadas(uuid, date, date, uuid, integer)
  from public, anon, authenticated, service_role;
