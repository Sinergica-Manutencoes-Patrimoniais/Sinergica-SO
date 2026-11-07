-- ADR-0216: projeção mínima; texto livre permanece restrito.
create function pcm.sso_listar_triagens_intencao_os(p_cliente_id uuid,p_intencao_id uuid,p_apos integer,p_limite integer)
returns table(id uuid,revisao integer,acao text,resultado_declarado text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reprogramacao_os_enviada_gate where id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_intencao_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.reprogramacao_os_intencoes i join pcm.ordens_servico os on os.id=i.os_id and os.client_id=i.cliente_id and os.deleted_at is null
      where i.id=p_intencao_id and i.cliente_id=p_cliente_id) then raise exception 'intencao_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select e.id,e.revisao,e.acao,e.resultado_declarado,e.ator_id,e.criado_em
    from pcm.reprogramacao_os_intencao_eventos e where e.intencao_id=p_intencao_id and (p_apos is null or e.revisao>p_apos)
    order by e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_triagens_intencao_os(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
