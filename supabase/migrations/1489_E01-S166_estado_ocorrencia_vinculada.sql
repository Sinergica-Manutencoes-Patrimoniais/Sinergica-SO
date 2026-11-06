-- ADR-1339: projeção parcial de fontes existentes; sem escrita operacional.
create table pcm.sso_estado_ocorrencia_vinculada_gate(
  id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into pcm.sso_estado_ocorrencia_vinculada_gate(id,habilitado) values(true,false);
alter table pcm.sso_estado_ocorrencia_vinculada_gate enable row level security;
alter table pcm.sso_estado_ocorrencia_vinculada_gate force row level security;
revoke all on pcm.sso_estado_ocorrencia_vinculada_gate from public,anon,authenticated,service_role;

create function pcm.sso_estado_ocorrencia_vinculada(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_o pcm.ocorrencias_rotina_preparadas%rowtype;
  v_leg pcm.ocorrencias_preventivas%rowtype;
  v_id uuid;
  v_total bigint;
  v_ativas bigint;
  v_finalizadas bigint;
  v_estado text;
begin
  perform 1 from pcm.sso_estado_ocorrencia_vinculada_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_preparada_id is null
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  select o.* into v_o from pcm.ocorrencias_rotina_preparadas o
    join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
    where o.id=p_preparada_id and o.plano_id=p_plano_id;
  if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
  select v.ocorrencia_legada_id into v_id from pcm.ocorrencias_rotina_vinculos v where v.ocorrencia_preparada_id=v_o.id;
  if v_id is null then
    return pg_catalog.jsonb_build_object('preparadaId',v_o.id,'estado','indeterminado','motivo','sem_vinculo','completude','parcial');
  end if;
  select leg.* into v_leg from pcm.ocorrencias_preventivas leg join pcm.planos_preventivos p on p.id=leg.plano_id
    where leg.id=v_id and p.cliente_id=p_cliente_id and leg.vencimento=v_o.vencimento_original
      and ((v_o.alvo_tipo='sistema' and p.sistema_id=v_o.alvo_id)
        or (v_o.alvo_tipo='componente' and p.equipamento_id=v_o.alvo_id));
  if not found then
    return pg_catalog.jsonb_build_object('preparadaId',v_o.id,'estado','indeterminado','motivo','vinculo_divergente','completude','parcial');
  end if;
  select count(*), count(*) filter (where os.client_id=p_cliente_id and os.deleted_at is null),
    count(*) filter (where os.client_id=p_cliente_id and os.deleted_at is null and os.status='finalizado')
    into v_total,v_ativas,v_finalizadas from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_leg.id;
  v_estado:=case
    when v_total>1 or v_total<>v_ativas then 'indeterminado'
    when v_leg.resultado_estado in ('ok','nao_ok') then 'resultado_registrado'
    when v_leg.resultado_estado='pendente' and v_total=0 and v_leg.envio_estado='prevista' and v_leg.auvo_task_id is null then 'candidata_aguardando'
    else 'indeterminado' end;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pg_catalog.jsonb_build_object('preparadaId',v_o.id,'estado',v_estado,'motivo','fonte_legada',
    'resultadoPreventivo',v_leg.resultado_estado,'ordensAtivas',v_ativas,'ordensFinalizadas',v_finalizadas,'completude','parcial');
end;
$$;
revoke all on function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) to authenticated;
