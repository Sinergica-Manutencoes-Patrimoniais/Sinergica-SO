-- ADR-1216: histórico interno, escopado à despesa e sem alterar suas atribuições.
create function pcm.sso_historico_tecnico_despesa(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_despesa_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,participacao_id uuid,tecnico_nome text,vinculo text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_despesa_id is null or p_apos is null or p_apos < 0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_exigir_atribuicao_tecnico_mediada(p_ator_id,p_cliente_id,p_visita_id);
  perform 1 from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id and visita_id=p_visita_id for share;
  if not found then raise exception 'despesa_indisponivel' using errcode='42501'; end if;
  return query select a.revisao,
    case when e.cliente_id=p_cliente_id and e.visita_id=p_visita_id then e.id else null end,
    case when e.cliente_id=p_cliente_id and e.visita_id=p_visita_id then f.nome else null end,
    case when a.participacao_id is null then 'sem_atribuicao' when e.id is null then 'ausente'
      when e.cliente_id<>p_cliente_id or e.visita_id<>p_visita_id then 'incompativel'
      when e.encerrado_em is null then 'vigente' else 'encerrado' end,
    a.motivo,a.ator_id,a.criado_em
  from pcm.sso_despesa_atribuicoes_tecnico a
  left join pcm.visita_equipes e on e.id=a.participacao_id
  left join pcm.funcionarios f on f.id=e.funcionario_id and e.cliente_id=p_cliente_id and e.visita_id=p_visita_id
  where a.despesa_id=p_despesa_id and a.revisao>p_apos order by a.revisao limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_tecnico_despesa(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_tecnico_despesa(uuid,uuid,uuid,uuid,integer,integer) to authenticated;
