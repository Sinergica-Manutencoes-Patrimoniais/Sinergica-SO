-- ADR-0469: amostra local de notas, sem inferir destino ou modificar fila.
create function pcm.sso_estatisticas_notas_triagem(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare qtd integer; pendente integer; processando integer; erro integer; enviado integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  with amostra as materialized (
    select n.created_at,n.request_id,n.status_observado from pcm.reconciliacao_outbox_notas n join pcm.auvo_sync_outbox o on o.id=n.outbox_id
    where n.cliente_id=p_cliente_id and ((o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id))
      or (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id)))
    order by n.created_at,n.request_id limit 1001
  ), ordenados as (select status_observado,row_number() over(order by created_at,request_id) pos from amostra)
  select count(*)::integer,count(*) filter(where pos<=1000 and status_observado='pending')::integer,count(*) filter(where pos<=1000 and status_observado='processing')::integer,
    count(*) filter(where pos<=1000 and status_observado='error')::integer,count(*) filter(where pos<=1000 and status_observado='sent')::integer
    into qtd,pendente,processando,erro,enviado from ordenados;
  return jsonb_build_object('limite',1000,'consideradas',least(qtd,1000),'truncado',qtd>1000,'pendenteObservado',pendente,'processandoObservado',processando,
    'erroObservado',erro,'enviadoObservado',enviado,'estadoRemoto','desconhecido');
end $$;
revoke all on function pcm.sso_estatisticas_notas_triagem(uuid) from public,anon,authenticated,service_role;
