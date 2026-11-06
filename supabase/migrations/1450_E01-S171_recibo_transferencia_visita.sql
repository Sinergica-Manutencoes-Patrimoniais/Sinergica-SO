-- ADR-1303: leitura de recibo, sem executar ou cancelar transferência.
create table pcm.sso_recibo_transferencia_visita_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_recibo_transferencia_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_recibo_transferencia_visita_gate enable row level security;
alter table pcm.sso_recibo_transferencia_visita_gate force row level security;
revoke all on pcm.sso_recibo_transferencia_visita_gate from public,anon,authenticated,service_role;

create function pcm.sso_recibo_transferencia_visita(
  p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_origem_id uuid,p_destino_id uuid,
  p_vinculo_id uuid,p_novo_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,
  p_sequencia integer,p_motivo text,p_confirmadas boolean
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_comando pcm.visita_comandos%rowtype; v_payload jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
    or p_request_id is null or p_origem_id is null or p_destino_id is null or p_origem_id=p_destino_id
    or p_vinculo_id is null or p_novo_vinculo_id is null or p_revisao_origem is null or p_revisao_origem<1
    or p_revisao_destino is null or p_revisao_destino<1 or p_sequencia is null or p_sequencia<1
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_confirmadas is null then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_recibo_transferencia_visita_gate where id and habilitado for share;
  if not found then raise exception 'recibo_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  v_payload:=jsonb_build_object('tipo',case when p_confirmadas then 'transferirOsConfirmadaPreparado' else 'transferirOsVisita' end,
    'origemId',p_origem_id,'destinoId',p_destino_id,'vinculoId',p_vinculo_id,'novoVinculoId',p_novo_vinculo_id,
    'revisaoOrigem',p_revisao_origem,'revisaoDestino',p_revisao_destino,'sequencia',p_sequencia,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into v_comando from pcm.visita_comandos where request_id=p_request_id;
  if not found then return jsonb_build_object('encontrado',false,'requestId',p_request_id); end if;
  if v_comando.actor_id is distinct from p_ator_id or v_comando.cliente_id is distinct from p_cliente_id
    or v_comando.payload is distinct from v_payload then raise exception 'sem_acesso_ou_tentativa_divergente' using errcode='42501'; end if;
  if not exists(select 1 from pcm.visitas where id=p_origem_id and cliente_id=p_cliente_id)
    or not exists(select 1 from pcm.visitas where id=p_destino_id and cliente_id=p_cliente_id)
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  return jsonb_build_object('encontrado',true,'requestId',p_request_id,'resultado',v_comando.resultado);
end; $$;
revoke all on function pcm.sso_recibo_transferencia_visita(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_transferencia_visita(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean) to authenticated;
