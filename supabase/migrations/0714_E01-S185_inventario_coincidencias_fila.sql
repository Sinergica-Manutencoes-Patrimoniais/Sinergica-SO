-- ADR-0488: coincidência de campos não constitui identidade de evento.
create function pcm.sso_inventario_coincidencias_fila(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare quantidade integer; grupos integer; linhas integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  with amostra as materialized (
    select o.id,o.entity,o.row_id,o.op from pcm.auvo_sync_outbox o where
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id))
    order by o.id limit 1001
  ), numerados as (select *,row_number() over(order by id) pos from amostra), coincidentes as (
    select entity,row_id,op,count(*)::integer qtd from numerados where pos<=1000 group by entity,row_id,op having count(*)>1)
  select (select count(*)::integer from numerados),count(*)::integer,coalesce(sum(qtd),0)::integer into quantidade,grupos,linhas from coincidentes;
  return jsonb_build_object('consideradas',least(quantidade,1000),'limite',1000,'truncado',quantidade>1000,
    'gruposCoincidentes',grupos,'linhasCoincidentes',linhas,'provaDuplicidade',false,'estadoRemoto','desconhecido');
end $$;
revoke all on function pcm.sso_inventario_coincidencias_fila(uuid) from public,anon,authenticated,service_role;
