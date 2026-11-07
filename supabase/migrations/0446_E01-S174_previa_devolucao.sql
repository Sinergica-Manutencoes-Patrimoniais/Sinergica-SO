-- ADR-0220: somente diagnóstico, nunca autoriza devolução.
create function pcm.sso_prever_devolucao_backlog(p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(pendencia_id uuid,parcela_id uuid,descricao text,situacao text,os_atendimento_id uuid,ordens_nao_finalizadas bigint,elegibilidade text,motivos text[])
language plpgsql stable security definer set search_path='' as $$
declare v_v pcm.sso_backlog_chamado_vinculos%rowtype;v_nao_finalizadas bigint;
begin
  if p_composicao_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_v from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_v.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_v.cliente_id) is not true
    or not exists(select 1 from pcm.chamados c where c.id=v_v.chamado_id and c.cliente_id=v_v.cliente_id and c.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*) into v_nao_finalizadas from pcm.ordens_servico o where o.chamado_id=v_v.chamado_id and o.client_id=v_v.cliente_id and o.deleted_at is null and o.status is distinct from 'finalizado';
  return query select p.pendencia_id,p.parcela_id,c.descricao,c.situacao,c.os_atendimento_id,v_nao_finalizadas,'nao_comprovada'::text,
    array_remove(array['suspensao_do_chamado_nao_comprovada','atribuicao_de_trabalho_a_parcela_nao_comprovada',
      case when c.situacao='atendida' then 'parcela_registrada_atendida' end,
      case when v_nao_finalizadas>0 then 'ha_os_nao_finalizada_no_chamado' end],null)
    from pcm.sso_backlog_parcelas p join pcm.chamado_escopo_parcelas c on c.id=p.parcela_id and c.chamado_id=p.chamado_id
    where p.composicao_id=p_composicao_id and p.chamado_id=v_v.chamado_id and p.cliente_id=v_v.cliente_id and (p_apos is null or p.pendencia_id>p_apos)
    order by p.pendencia_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_prever_devolucao_backlog(uuid,uuid,integer) from public,anon,authenticated,service_role;
