-- ADR-0982: leitura privada de precondições declaradas; não comprova cobertura nem parada.
create function pcm.sso_consultar_retorno_parcial(p_cliente_id uuid,p_ciclo_id uuid,p_proposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_proposta pcm.chamado_continuacoes_propostas%rowtype;v_os pcm.ordens_servico%rowtype;v_suspensao pcm.sso_suspensoes_chamado%rowtype;
  v_interrupcao pcm.sso_interrupcoes_parcela%rowtype;v_revisao pcm.sso_revisoes_parcela%rowtype;v_vinculo pcm.sso_continuacao_parcela_vinculos%rowtype;v_hash text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_retorno_parcial_gate where id and habilitado for share;
  if not found then raise exception 'retorno_parcial_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_continuacao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_ciclo_id is null or p_proposta_id is null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id for share;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=v_ciclo.parcela_id and chamado_id=v_chamado.id for share;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=p_proposta_id and chamado_id=v_chamado.id for share;
  if v_ciclo.id is null or v_parcela.id is null or v_proposta.id is null then raise exception 'contexto_indisponivel' using errcode='23514'; end if;
  select * into v_os from pcm.ordens_servico where id=v_proposta.os_anterior_id and chamado_id=v_chamado.id and client_id=p_cliente_id and deleted_at is null for share;
  if v_os.id is null or not exists(select 1 from pcm.sso_atribuicoes_parcela a where a.parcela_id=v_parcela.id and a.os_id=v_os.id and a.chamado_id=v_chamado.id and a.cliente_id=p_cliente_id) then raise exception 'atribuicao_indisponivel' using errcode='23514'; end if;
  select * into v_suspensao from pcm.sso_suspensoes_chamado where chamado_id=v_chamado.id and cliente_id=p_cliente_id;
  select * into v_interrupcao from pcm.sso_interrupcoes_parcela where parcela_id=v_parcela.id and os_id=v_os.id and chamado_id=v_chamado.id and cliente_id=p_cliente_id;
  select * into v_revisao from pcm.sso_revisoes_parcela where parcela_id=v_parcela.id and cliente_id=p_cliente_id order by revisao desc limit 1;
  v_hash:=encode(sha256(convert_to(to_jsonb(v_proposta)::text,'UTF8')),'hex');
  select * into v_vinculo from pcm.sso_continuacao_parcela_vinculos where cliente_id=p_cliente_id and ciclo_id=p_ciclo_id and parcela_id=v_parcela.id
    and proposta_id=p_proposta_id and proposta_sha256=v_hash order by criado_em desc,request_id desc limit 1;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'cicloId',p_ciclo_id,'parcelaId',v_parcela.id,'propostaId',p_proposta_id,
    'cicloEstado',v_ciclo.estado,'cicloRevision',v_ciclo.revisao,'parcelaSituacao',v_parcela.situacao,'osId',v_os.id,'osStatus',v_os.status,
    'propostaSituacao',v_proposta.situacao,'possuiOsContinuacao',v_proposta.os_continuacao_id is not null,'descricaoRestante',v_proposta.descricao_restante,
    'minutosRestantes',v_proposta.minutos_restantes,'propostaSha256',v_hash,'vinculoRequestId',v_vinculo.request_id,
    'suspensaoEstado',v_suspensao.estado,'suspensaoRevision',v_suspensao.revisao,'interrupcaoEstado',v_interrupcao.estado,'interrupcaoRevision',v_interrupcao.revisao,
    'revisaoHumana',v_revisao.revisao,'revisaoOsId',v_revisao.os_id,'revisaoAtendida',v_revisao.atendida,'paradaComprovada',false);
end; $$;
revoke all on function pcm.sso_consultar_retorno_parcial(uuid,uuid,uuid) from public,anon,authenticated,service_role;
