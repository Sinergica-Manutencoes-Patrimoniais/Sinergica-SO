-- ADR-0205: consulta de histórico; acesso não concedido.
create function pcm.sso_listar_excecoes_materiais_os(p_cliente_id uuid,p_os_id uuid,p_apos_lista uuid,p_apos_revisao integer,p_limite integer)
returns table(lista_id uuid,revisao integer,motivo text,descricao text,revisao_linhas integer,posicao integer,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_cliente_id is null or p_os_id is null or p_limite is null or p_limite not between 1 and 100 or ((p_apos_lista is null)<>(p_apos_revisao is null)) or (p_apos_revisao is not null and p_apos_revisao<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('material.gerir',p_cliente_id) is not true or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  return query select l.id,e.revisao,e.dados->>'motivo',e.dados->>'descricao',
    case when e.dados->>'revisaoLinhas' ~ '^[0-9]{1,9}$' then (e.dados->>'revisaoLinhas')::integer end,
    case when e.dados->>'posicao' ~ '^[0-9]{1,4}$' then (e.dados->>'posicao')::integer end,e.ator_id,e.criado_em
    from pcm.listas_materiais l join pcm.sso_lista_materiais_eventos e on e.lista_id=l.id and e.tipo='excecao'
    where l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id and (p_apos_lista is null or (l.id,e.revisao)>(p_apos_lista,p_apos_revisao))
    order by l.id,e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_excecoes_materiais_os(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
