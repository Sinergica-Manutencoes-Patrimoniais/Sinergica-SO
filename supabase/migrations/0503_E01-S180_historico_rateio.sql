-- ADR-0277: histórico interno com parcelas, inclusive rateios vazios.
create function pcm.sso_historico_rateio_despesa(p_cliente_id uuid,p_visita_id uuid,p_despesa_id uuid,p_apos integer default 0)
returns table(revisao integer,ator_id uuid,criado_em timestamptz,parcelas jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_despesa_id is null or p_apos is null or p_apos<0
    or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.despesas_visita d where d.id=p_despesa_id and d.cliente_id=p_cliente_id and d.visita_id=p_visita_id)
    then raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.conferencia_despesa_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  return query select r.revisao,r.ator_id,r.criado_em,coalesce((
    select jsonb_agg(jsonb_build_object('vinculoId',p.vinculo_id,'osId',case when vo.cliente_id=p_cliente_id and vo.visita_id=p_visita_id then vo.os_id else null end,'valorCentavos',p.valor_centavos::text,
      'vinculo',case when vo.id is null then 'ausente' when vo.cliente_id<>p_cliente_id or vo.visita_id<>p_visita_id then 'incompativel'
        when vo.encerrado_em is not null then 'encerrado' else 'vigente' end) order by p.vinculo_id)
      from pcm.despesa_visita_rateio_parcelas p left join pcm.visita_ordens_servico vo on vo.id=p.vinculo_id
      where p.despesa_id=r.despesa_id and p.revisao=r.revisao), '[]'::jsonb)
    from pcm.despesa_visita_rateios r where r.despesa_id=p_despesa_id and r.revisao>p_apos order by r.revisao limit 20;
end $$;
revoke all on function pcm.sso_historico_rateio_despesa(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
