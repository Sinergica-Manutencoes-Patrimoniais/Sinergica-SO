-- ADR-0154: consultas preparadas e revogadas.
create function pcm.sso_listar_pendencias_contexto(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,alvo_tipo text,alvo_id uuid,alvo_nome text,pergunta text,observacao text,estado text,revisao integer,criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.alvo_tipo,p.alvo_id,
    case p.alvo_tipo when 'sistema' then s.nome when 'componente' then e.nome when 'grupo' then g.nome end,
    p.pergunta,p.observacao,p.estado,p.revisao,p.criado_em
    from pcm.sso_pendencias_tecnicas p
    left join pcm.sistemas s on p.alvo_tipo='sistema' and s.id=p.alvo_id and s.cliente_id=p.cliente_id
    left join pcm.equipamentos e on p.alvo_tipo='componente' and e.id=p.alvo_id and e.client_id=p.cliente_id
    left join pcm.grupos_quantitativos g on p.alvo_tipo='grupo' and g.id=p.alvo_id and g.cliente_id=p.cliente_id
    where p.cliente_id=p_cliente_id and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_pendencias_contexto(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_decisoes_pendencia(p_pendencia_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,decisao text,motivo text,ator_id uuid,ocorrido_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_pendencia_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos < 1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select p.cliente_id into v_cliente from pcm.sso_pendencias_tecnicas p where p.id=p_pendencia_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select d.revisao,d.decisao,d.motivo,d.ator_id,d.ocorrido_em from pcm.sso_pendencias_decisoes d
    where d.pendencia_id=p_pendencia_id and (p_apos is null or d.revisao>p_apos) order by d.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_decisoes_pendencia(uuid,integer,integer) from public,anon,authenticated,service_role;
