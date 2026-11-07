-- ADR-0978: declaração privada para ciclo posterior, sem efeito remoto.
create function pcm.sso_declarar_interrupcao_ciclo(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,
  p_parcela_id uuid,p_os_id uuid,p_escopo_revision bigint,p_suspensao_revision integer,p_expected_revision integer,p_estado text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;
  v_escopo pcm.chamado_escopo_composicoes%rowtype;v_suspensao pcm.sso_suspensoes_chamado%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_interrupcao pcm.sso_interrupcoes_parcela%rowtype;v_evento pcm.sso_interrupcoes_parcela_eventos%rowtype;
  v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.sso_interrupcao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'interrupcao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_cliente_id is null or p_ciclo_id is null
    or p_parcela_id is null or p_os_id is null or p_escopo_revision is null or p_escopo_revision<1 or p_suspensao_revision is null or p_suspensao_revision<1
    or p_expected_revision is null or p_expected_revision<0 or p_estado is null or p_estado not in ('declarada','revogada')
    or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'escopoRevision',p_escopo_revision,'suspensaoRevision',p_suspensao_revision,
    'expectedRevision',p_expected_revision,'estado',p_estado,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('interrupcao-parcela:'||p_request_id::text,0));
  select * into v_evento from pcm.sso_interrupcoes_parcela_eventos where request_id=p_request_id;
  if found then
    if v_evento.ator_id is distinct from v_ator or v_evento.payload is distinct from v_payload
      or not exists(select 1 from pcm.sso_ciclos_backlog c where c.id=p_ciclo_id and c.parcela_id=v_evento.parcela_id and c.cliente_id=p_cliente_id and c.legado_pendencia_id is null)
      then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('parcelaId',v_evento.parcela_id,'osId',v_evento.os_id,'revision',v_evento.revisao,'estado',v_evento.estado,'requestId',p_request_id);
  end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id and legado_pendencia_id is null;
  if not found then raise exception 'ciclo_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=v_chamado.id for update;
  select * into v_suspensao from pcm.sso_suspensoes_chamado where chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id and chamado_id=v_chamado.id for update;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado.id for update;
  if v_escopo.chamado_id is null or v_escopo.revisao is distinct from p_escopo_revision or v_suspensao.estado is distinct from 'suspenso'
    or v_suspensao.revisao is distinct from p_suspensao_revision then raise exception 'revisao_ou_suspensao_invalida' using errcode='40001'; end if;
  if v_ciclo.id is null or v_ciclo.estado<>'em_tratamento' or v_ciclo.legado_pendencia_id is not null or v_parcela.id is null or v_parcela.situacao<>'pendente'
    or pcm.sso_ciclo_promocao_valida(p_cliente_id,v_ciclo.id,v_chamado.id,v_parcela.id) is distinct from true
    then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
  perform 1 from pcm.ordens_servico o join pcm.sso_atribuicoes_parcela a on a.os_id=o.id and a.parcela_id=p_parcela_id and a.chamado_id=o.chamado_id and a.cliente_id=o.client_id
    where o.id=p_os_id and o.chamado_id=v_chamado.id and o.client_id=p_cliente_id and o.deleted_at is null for share of o,a;
  if not found then raise exception 'os_ou_atribuicao_incompativel' using errcode='23514'; end if;
  select * into v_interrupcao from pcm.sso_interrupcoes_parcela where parcela_id=p_parcela_id and os_id=p_os_id for update;
  if coalesce(v_interrupcao.revisao,0)<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if (v_interrupcao.parcela_id is null and p_estado<>'declarada') or (v_interrupcao.parcela_id is not null and v_interrupcao.estado=p_estado) then raise exception 'transicao_invalida' using errcode='23514'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_interrupcoes_parcela(parcela_id,os_id,chamado_id,cliente_id,estado,revisao) values(p_parcela_id,p_os_id,v_chamado.id,p_cliente_id,p_estado,p_expected_revision+1)
    on conflict(parcela_id,os_id) do update set estado=excluded.estado,revisao=excluded.revisao,atualizado_em=now();
  insert into pcm.sso_interrupcoes_parcela_eventos(parcela_id,os_id,revisao,estado,motivo,ator_id,request_id,payload)
    values(p_parcela_id,p_os_id,p_expected_revision+1,p_estado,v_motivo,v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'revision',p_expected_revision+1,'estado',p_estado,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.interrupcao_declarada','chamados',v_chamado.id,
    v_resultado||jsonb_build_object('clienteId',p_cliente_id,'cicloId',p_ciclo_id,'motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_interrupcao_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,bigint,integer,integer,text,text) from public,anon,authenticated,service_role;
