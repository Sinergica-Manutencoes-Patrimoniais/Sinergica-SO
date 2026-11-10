-- ADR-1287: projeção limitada do último evento aceito, sem atualização da OS.
create function pcm.sso_detalhar_ultimo_evento_campo(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_evento pcm.sso_origem_campo_eventos%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_consulta_estado_campo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select ev.* into v_evento from pcm.sso_origem_campo_processamentos p
    join pcm.ordens_servico o on o.id=p.os_id and o.client_id=p.cliente_id and o.deleted_at is null
    join lateral (select e.* from pcm.sso_origem_campo_eventos e where e.integracao=p.integracao and e.task_id=p.task_id and e.estado='aceito' order by e.ordem_externa desc limit 1) ev on true
    where p.cliente_id=p_cliente_id and p.os_id=p_os_id;
  if not found then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'ordemExterna',v_evento.ordem_externa::text,
    'statusCampo',v_evento.projecao->>'statusCampo','titulo',v_evento.projecao->>'titulo','descricao',v_evento.projecao->>'descricao',
    'tecnicoAuvoId',v_evento.projecao->>'tecnicoAuvoId','dataAgendada',v_evento.projecao->>'dataAgendada',
    'checkIn',v_evento.projecao->>'checkIn','checkOut',v_evento.projecao->>'checkOut',
    'validacaoPcmComprovada',false,'osAlterada',false);
end; $$;
revoke all on function pcm.sso_detalhar_ultimo_evento_campo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_detalhar_ultimo_evento_campo(uuid,uuid,uuid) to authenticated;
