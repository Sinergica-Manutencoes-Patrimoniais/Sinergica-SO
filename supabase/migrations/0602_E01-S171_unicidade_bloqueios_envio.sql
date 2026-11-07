-- ADR-0376: unicidade reforçada no livro de comandos; não cria fila.
create unique index sso_intencao_local_visita_os_revisao_uq on pcm.visita_comandos
  (cliente_id,(payload->>'visitaId'),(payload->>'osId'),(payload->>'expectedRevision'))
  where payload->>'tipo'='intencaoEnvioLocalBloqueada';
create function pcm.sso_bloqueios_intencao_local(p_cliente_id uuid,p_visita_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v pcm.visitas%rowtype; o pcm.ordens_servico%rowtype; c pcm.visita_confirmacoes%rowtype; pol record;
  bloqueios jsonb:=jsonb_build_array('dispatch_desabilitado','revisao_conteudo_os_nao_comprovada'); v_confirmacao boolean:=false; v_existente boolean;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_os_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.intencao_local_envio_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v.estado<>'confirmada' then bloqueios:=bloqueios||jsonb_build_array('confirmacao_pcm_pendente'); end if;
  if not exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v.id and vo.os_id=o.id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null)
    then bloqueios:=bloqueios||jsonb_build_array('vinculo_os_inativo'); end if;
  if o.status in ('finalizado','cancelado') then bloqueios:=bloqueios||jsonb_build_array('os_encerrada'); end if;
  if o.auvo_task_id is not null then bloqueios:=bloqueios||jsonb_build_array('tarefa_remota_ja_identificada'); end if;
  select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
  select * into pol from pcm.sso_resolver_ciencia_visita(v.id);
  if c.id is null then bloqueios:=bloqueios||jsonb_build_array('snapshot_confirmacao_ausente');
  elsif pol.modo is distinct from c.politica_modo or pol.origem is distinct from c.politica_origem or pol.politica_id is distinct from c.politica_id or pol.politica_revisao is distinct from c.politica_revisao
    then bloqueios:=bloqueios||jsonb_build_array('politica_desatualizada');
  elsif pol.modo='obrigatoria' then
    if not coalesce((select habilitado from pcm.portal_confirmacao_cliente_gate where id),false) or not coalesce((select habilitado from pcm.portal_visita_gate where id),false)
      then bloqueios:=bloqueios||jsonb_build_array('fonte_confirmacao_indisponivel');
    else
      select exists(select 1 from pcm.portal_confirmacoes_cliente x join pcm.portal_visita_publicacoes pub on pub.id=x.publicacao_id
        join pcm.visita_ordens_servico vo on vo.visita_id=pub.visita_id and vo.os_id=pub.os_id and vo.cliente_id=pub.cliente_id and vo.encerrado_em is null
        join pcm.ordens_servico os on os.id=vo.os_id and os.client_id=vo.cliente_id and os.deleted_at is null
        where x.confirmacao_pcm_id=c.id and pub.visita_id=v.id and pub.cliente_id=v.cliente_id and pub.revisao_visita=v.revisao and pub.revogado_em is null) into v_confirmacao;
      if not v_confirmacao then bloqueios:=bloqueios||jsonb_build_array('confirmacao_cliente_pendente'); end if;
    end if;
  end if;
  if statement_timestamp()<v.inicio_em-interval '24 hours' then bloqueios:=bloqueios||jsonb_build_array('fora_janela_t24'); end if;
  select exists(select 1 from pcm.visita_comandos x where x.cliente_id=p_cliente_id and x.payload->>'tipo'='intencaoEnvioLocalBloqueada'
    and x.payload->>'visitaId'=v.id::text and x.payload->>'osId'=o.id::text and x.payload->>'expectedRevision'=v.revisao::text) into v_existente;
  return jsonb_build_object('visitaId',v.id,'osId',o.id,'revision',v.revisao,'inicioJanela',v.inicio_em-interval '24 hours',
    'intencaoExistente',v_existente,'bloqueios',bloqueios,'autorizaEnvio',false);
end $$;
revoke all on function pcm.sso_bloqueios_intencao_local(uuid,uuid,uuid) from public,anon,authenticated,service_role;
