-- ADR-0117: referência para conferência, jamais criação de Pendência ou interpretação de resposta.
create function pcm.sso_listar_referencias_avaliacoes(p_cliente_id uuid, p_apos uuid, p_limite integer)
returns table (avaliacao_id uuid, ocorrencia_id uuid, vencimento date, pergunta_referencia text, recebido_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not config.sso_autorizar_acao('execucao.validar', p_cliente_id) then
    raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode = '22023'; end if;
  return query select a.id, o.id, o.vencimento, a.item_referencia, a.recebido_em
    from pcm.avaliacoes_preventivas a
    join pcm.ocorrencias_preventivas o on o.id = a.ocorrencia_id
    join pcm.planos_preventivos p on p.id = o.plano_id
    where p.cliente_id = p_cliente_id and (p_apos is null or a.id > p_apos)
    order by a.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_referencias_avaliacoes(uuid,uuid,integer) from public, anon, service_role;
grant execute on function pcm.sso_listar_referencias_avaliacoes(uuid,uuid,integer) to authenticated;
