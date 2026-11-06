-- ADR-0839: fechamento consistente com leitura, gates e ACLs preservados.
create or replace function pcm.sso_comando_escopo_chamado(
  p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint,
  p_acao text, p_item_id uuid, p_descricao text, p_os_id uuid, p_minutos integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_chamado pcm.chamados%rowtype;
  v_anterior pcm.chamado_os_comandos%rowtype;
  v_payload jsonb;
  v_resultado jsonb;
  v_capacidade text;
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id), false) then
    raise exception 'comando_bloqueado' using errcode = '55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_acao is null then
    raise exception 'comando_invalido' using errcode = '22023';
  end if;
  v_capacidade := case p_acao
    when 'adicionar_parcela' then 'chamado.escopo.gerir'
    when 'atender_parcela' then 'chamado.escopo.gerir'
    when 'declarar_composicao' then 'chamado.escopo.gerir'
    when 'propor_continuacao' then 'chamado.continuacao.sugerir'
    when 'encerrar' then 'chamado.encerrar'
    else null end;
  if v_capacidade is null then raise exception 'acao_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('acao', p_acao, 'clienteId', p_cliente_id, 'chamadoId', p_chamado_id,
    'expectedRevision', p_expected_revision, 'itemId', p_item_id, 'descricao', p_descricao,
    'osId', p_os_id, 'minutos', p_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:' || p_request_id::text, 0));
  select * into v_anterior from pcm.chamado_os_comandos where request_id = p_request_id;
  if found then
    if v_anterior.actor_id is distinct from v_actor
      or config.sso_autorizar_acao(v_capacidade, v_anterior.cliente_id) is distinct from true then
      raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_anterior.resultado;
  end if;
  select * into v_chamado from pcm.chamados where id = p_chamado_id for update;
  if not found or v_chamado.deleted_at is not null or v_chamado.cliente_id is distinct from p_cliente_id
    or config.sso_autorizar_acao(v_capacidade, p_cliente_id) is distinct from true then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_chamado.sso_revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_chamado.sso_encerrado_em is not null or v_chamado.status = 'cancelado' then
    raise exception 'chamado_nao_editavel' using errcode = '23514';
  end if;
  if p_acao = 'adicionar_parcela' then
    if p_item_id is null or p_descricao is null or length(btrim(p_descricao)) not between 1 and 1000
      or p_os_id is not null or p_minutos is not null then raise exception 'parcela_invalida' using errcode = '22023'; end if;
    insert into pcm.chamado_escopo_parcelas(id, chamado_id, descricao, created_by)
      values (p_item_id, p_chamado_id, btrim(p_descricao), v_actor);
    insert into pcm.chamado_escopo_composicoes(chamado_id, declarada_completa)
      values (p_chamado_id, false) on conflict (chamado_id) do update set declarada_completa = false,
        revisao = pcm.chamado_escopo_composicoes.revisao + 1;
  elsif p_acao = 'atender_parcela' then
    if p_item_id is null or p_os_id is null or p_descricao is not null or p_minutos is not null then
      raise exception 'parcela_invalida' using errcode = '22023'; end if;
    perform 1 from pcm.ordens_servico o where o.id = p_os_id and o.chamado_id = p_chamado_id
      and o.client_id = p_cliente_id and o.deleted_at is null and o.status = 'finalizado' for update;
    if not found then raise exception 'os_nao_finalizada_ou_invalida' using errcode = '23514'; end if;
    update pcm.chamado_escopo_parcelas set situacao = 'atendida', os_atendimento_id = p_os_id
      where id = p_item_id and chamado_id = p_chamado_id and situacao = 'pendente';
    if not found then raise exception 'parcela_nao_disponivel' using errcode = '23514'; end if;
  elsif p_acao = 'declarar_composicao' then
    if p_item_id is not null or p_os_id is not null or p_descricao is not null or p_minutos is not null
      or not exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id = p_chamado_id) then
      raise exception 'composicao_invalida' using errcode = '23514'; end if;
    update pcm.chamado_escopo_composicoes set declarada_completa = true, revisao = revisao + 1
      where chamado_id = p_chamado_id;
    if not found then raise exception 'composicao_inexistente' using errcode = '23514'; end if;
  elsif p_acao = 'propor_continuacao' then
    if p_item_id is null or p_os_id is null or p_descricao is null or length(btrim(p_descricao)) not between 1 and 4000
      or p_minutos is null or p_minutos < 1 then raise exception 'continuacao_invalida' using errcode = '22023'; end if;
    perform 1 from pcm.ordens_servico o where o.id = p_os_id and o.chamado_id = p_chamado_id
      and o.client_id = p_cliente_id and o.deleted_at is null for update;
    if not found then raise exception 'os_invalida' using errcode = '23514'; end if;
    insert into pcm.chamado_continuacoes_propostas(id, chamado_id, os_anterior_id, descricao_restante, minutos_restantes, created_by)
      values (p_item_id, p_chamado_id, p_os_id, btrim(p_descricao), p_minutos, v_actor);
  elsif p_acao = 'encerrar' then
    if p_item_id is not null or p_os_id is not null or p_descricao is not null or p_minutos is not null then
      raise exception 'encerramento_invalido' using errcode = '22023'; end if;
    -- Locks antecipam alterações de OS que respeitem a mesma ordem; escritores antigos ainda não a respeitam.
    perform 1 from pcm.ordens_servico o where (o.chamado_id = p_chamado_id or (o.id = v_chamado.ordem_servico_id and o.chamado_id is null)) and o.deleted_at is null order by o.id for update;
    perform pcm.sso_exigir_vinculo_chamado_consistente(p_cliente_id,p_chamado_id);
    if not exists(select 1 from pcm.chamado_escopo_composicoes where chamado_id = p_chamado_id and declarada_completa)
      or not exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id = p_chamado_id)
      or exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id = p_chamado_id and (situacao <> 'atendida' or os_atendimento_id is null))
      or exists(select 1 from pcm.chamado_continuacoes_propostas where chamado_id = p_chamado_id and situacao = 'pendente')
      or not exists(select 1 from pcm.ordens_servico where (chamado_id = p_chamado_id or (id = v_chamado.ordem_servico_id and chamado_id is null)) and deleted_at is null)
      or exists(select 1 from pcm.ordens_servico where (chamado_id = p_chamado_id or (id = v_chamado.ordem_servico_id and chamado_id is null)) and deleted_at is null and (client_id is distinct from p_cliente_id or status is distinct from 'finalizado')) then
      raise exception 'escopo_nao_atendido' using errcode = '23514'; end if;
  end if;
  update pcm.chamados set updated_at = now(), updated_by = v_actor,
    sso_encerrado_em = case when p_acao = 'encerrar' then now() else sso_encerrado_em end,
    sso_encerrado_por = case when p_acao = 'encerrar' then v_actor else sso_encerrado_por end
    where id = p_chamado_id returning * into v_chamado;
  v_resultado := jsonb_build_object('chamadoId', p_chamado_id, 'revision', v_chamado.sso_revisao,
    'acao', p_acao, 'requestId', p_request_id, 'itemId', p_item_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'chamado.escopo_' || p_acao, 'chamados', p_chamado_id, v_resultado);
  insert into pcm.chamado_os_comandos(request_id, actor_id, cliente_id, chamado_id, payload, resultado)
    values (p_request_id, v_actor, p_cliente_id, p_chamado_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;

create or replace function pcm.sso_encerrar_chamado_conferido(p_request_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_expected_revision bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_chamado pcm.chamados%rowtype;v_ant pcm.sso_encerramentos_chamado_conferidos%rowtype;v_payload jsonb;v_canonico jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) then raise exception 'encerramento_chamado_bloqueado' using errcode='55000'; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'encerramento_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'expectedRevision',p_expected_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
 if not found or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_encerramentos_chamado_conferidos where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 if v_chamado.sso_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 perform p.id from pcm.chamado_escopo_parcelas p where p.chamado_id=p_chamado_id order by p.id for update;
 perform c.id from pcm.chamado_continuacoes_propostas c where c.chamado_id=p_chamado_id order by c.id for update;
 perform o.id from pcm.ordens_servico o where (o.chamado_id=p_chamado_id or (o.id=v_chamado.ordem_servico_id and o.chamado_id is null)) and o.deleted_at is null order by o.id for update;
 perform pcm.sso_exigir_vinculo_chamado_consistente(p_cliente_id,p_chamado_id);
 if not exists(select 1 from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id and declarada_completa) or not exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id=p_chamado_id)
 or exists(select 1 from pcm.chamado_escopo_parcelas p left join pcm.ordens_servico o on o.id=p.os_atendimento_id and (o.chamado_id=p_chamado_id or (o.id=v_chamado.ordem_servico_id and o.chamado_id is null)) and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where p.chamado_id=p_chamado_id and (p.situacao<>'atendida' or o.id is null))
 or exists(select 1 from pcm.chamado_continuacoes_propostas c left join pcm.ordens_servico o on o.id=c.os_continuacao_id and (o.chamado_id=p_chamado_id or (o.id=v_chamado.ordem_servico_id and o.chamado_id is null)) and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where c.chamado_id=p_chamado_id and (c.situacao='pendente' or (c.situacao='executada' and o.id is null)))
 or not exists(select 1 from pcm.ordens_servico where (chamado_id=p_chamado_id or (id=v_chamado.ordem_servico_id and chamado_id is null)) and deleted_at is null) or exists(select 1 from pcm.ordens_servico where (chamado_id=p_chamado_id or (id=v_chamado.ordem_servico_id and chamado_id is null)) and deleted_at is null and (client_id is distinct from p_cliente_id or status is distinct from 'finalizado')) then raise exception 'escopo_nao_atendido' using errcode='23514'; end if;
 if config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_token_encerramento_chamado(txid,chamado_id) values(pg_catalog.txid_current(),p_chamado_id);
 v_canonico:=pcm.sso_comando_escopo_chamado(gen_random_uuid(),p_cliente_id,p_chamado_id,p_expected_revision,'encerrar',null,null,null,null);
 delete from pcm.sso_token_encerramento_chamado where txid=pg_catalog.txid_current() and chamado_id=p_chamado_id;
 v_resultado:=jsonb_build_object('chamadoId',p_chamado_id,'revision',v_canonico->'revision','requestId',p_request_id,'osAlteradas',false);
 insert into pcm.sso_encerramentos_chamado_conferidos(request_id,chamado_id,revisao_anterior,revisao_resultante,motivo,payload,resultado,ator_id) values(p_request_id,p_chamado_id,p_expected_revision,(v_canonico->>'revision')::bigint,btrim(p_motivo),v_payload,v_resultado,v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'chamado.encerramento_conferido','chamados',p_chamado_id,v_resultado);return v_resultado;
end; $$;

