-- ADR-0449: contagens limitadas; sem payload nem inferência de resultado remoto.
create function pcm.sso_resumo_outbox_reconciliacao(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_pendente integer; v_processando integer; v_erro integer; v_enviado integer; v_quantidade integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  with amostra as materialized (
    select o.id,o.status from pcm.auvo_sync_outbox o where
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id))
    order by o.id limit 1001
  ), numerados as (select status,row_number() over(order by id) as posicao from amostra)
  select count(*)::integer,count(*) filter(where posicao<=1000 and status='pending')::integer,
    count(*) filter(where posicao<=1000 and status='processing')::integer,count(*) filter(where posicao<=1000 and status='error')::integer,
    count(*) filter(where posicao<=1000 and status='sent')::integer
    into v_quantidade,v_pendente,v_processando,v_erro,v_enviado from numerados;
  return jsonb_build_object('limite',1000,'considerados',least(v_quantidade,1000),'truncado',v_quantidade>1000,
    'pendentes',v_pendente,'processando',v_processando,'erro',v_erro,'enviadosNaoConfirmados',v_enviado,'estadoRemoto','desconhecido');
end $$;
revoke all on function pcm.sso_resumo_outbox_reconciliacao(uuid) from public,anon,authenticated,service_role;
