-- ADR-0470: somente metadados inválidos de objetos com escopo comprovado.
create function pcm.sso_diagnostico_inconsistencias_fila(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare quantidade integer; erros integer;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  with amostra as materialized (
    select o.id,o.status,o.attempts,o.op,o.enqueued_at from pcm.auvo_sync_outbox o where
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id))
    order by o.id limit 1001
  ), numerados as (select *,row_number() over(order by id) pos from amostra)
  select count(*)::integer,count(*) filter(where pos<=1000 and (status is null or status not in ('pending','processing','sent','error')
    or attempts is null or attempts<0 or op is null or op not in ('create','update','delete') or enqueued_at is null))::integer into quantidade,erros from numerados;
  return jsonb_build_object('considerados',least(quantidade,1000),'limite',1000,'truncado',quantidade>1000,'inconsistencias',erros,
    'linhasSemClienteComprovado','nao_avaliadas','estadoRemoto','desconhecido','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_diagnostico_inconsistencias_fila(uuid) from public,anon,authenticated,service_role;
