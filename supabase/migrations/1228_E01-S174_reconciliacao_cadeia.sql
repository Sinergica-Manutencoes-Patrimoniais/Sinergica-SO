-- ADR-1077: preserva o núcleo e exige vínculo inequívoco para OS de continuidade.
create or replace function pcm.sso_reconciliar_parcela_humana(p_request_id uuid,p_parcela_id uuid,p_os_id uuid,p_evidencia_id uuid,p_expected_revision integer,p_suspensao_revision integer,p_interrupcao_revision integer,p_estado text,p_confirma boolean,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_p pcm.chamado_escopo_parcelas%rowtype;v_c pcm.chamados%rowtype;v_s pcm.sso_suspensoes_chamado%rowtype;v_i pcm.sso_interrupcoes_parcela%rowtype;v_ant pcm.sso_reconciliacoes_parcela%rowtype;v_rev integer;v_payload jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_reconciliacao_parcela_gate where id),false) then raise exception 'reconciliacao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_parcela_id is null or p_os_id is null or p_evidencia_id is null or p_expected_revision is null or p_expected_revision<0 or p_suspensao_revision is null or p_suspensao_revision<1 or p_interrupcao_revision is null or p_interrupcao_revision<1 or p_estado is null or p_estado not in ('nao_executada_declarada','incerta') or p_confirma is not true or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'evidenciaId',p_evidencia_id,'expectedRevision',p_expected_revision,'suspensaoRevision',p_suspensao_revision,'interrupcaoRevision',p_interrupcao_revision,'estado',p_estado,'confirma',true,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-parcela:'||p_request_id::text,0));
  select * into v_p from pcm.chamado_escopo_parcelas where id=p_parcela_id;
  if not found then raise exception 'parcela_indisponivel' using errcode='42501'; end if;
  select * into v_c from pcm.chamados where id=v_p.chamado_id for update;
  if not found or v_c.deleted_at is not null or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_p from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_c.id for update;
  select * into v_ant from pcm.sso_reconciliacoes_parcela where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('parcelaId',p_parcela_id,'revision',v_ant.revisao,'estado',v_ant.estado,'devolucaoAutorizada',false,'requestId',p_request_id);
  end if;
  if v_p.id is null or v_p.situacao<>'pendente' then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
  select coalesce(max(revisao),0) into v_rev from pcm.sso_reconciliacoes_parcela where parcela_id=p_parcela_id;
  if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_s from pcm.sso_suspensoes_chamado where chamado_id=v_c.id and cliente_id=v_c.cliente_id for update;
  select * into v_i from pcm.sso_interrupcoes_parcela where parcela_id=p_parcela_id and os_id=p_os_id and chamado_id=v_c.id and cliente_id=v_c.cliente_id for update;
  if v_s.estado is distinct from 'suspenso' or v_s.revisao is distinct from p_suspensao_revision or v_i.estado is distinct from 'declarada' or v_i.revisao is distinct from p_interrupcao_revision then raise exception 'suspensao_ou_interrupcao_obsoleta' using errcode='40001'; end if;
  if (select count(*) from pcm.sso_parcelas_da_os_cadeia(v_c.cliente_id,v_c.id,p_os_id))<>1
    or not exists(select 1 from pcm.sso_parcelas_da_os_cadeia(v_c.cliente_id,v_c.id,p_os_id) x where x.parcela_id=p_parcela_id)
    or not exists(select 1 from pcm.ordens_servico o join pcm.retorno_os_preparado r on r.os_id=o.id and r.cliente_id=o.client_id join pcm.retorno_evidencias_declaradas e on e.retorno_id=r.id where o.id=p_os_id and o.chamado_id=v_c.id and o.client_id=v_c.cliente_id and o.deleted_at is null and e.id=p_evidencia_id) then raise exception 'evidencia_ou_atribuicao_indisponivel' using errcode='23514'; end if;
  insert into pcm.sso_reconciliacoes_parcela(parcela_id,os_id,cliente_id,evidencia_id,revisao,suspensao_revision,interrupcao_revision,estado,motivo,ator_id,request_id,payload) values(p_parcela_id,p_os_id,v_c.cliente_id,p_evidencia_id,v_rev+1,p_suspensao_revision,p_interrupcao_revision,p_estado,btrim(p_motivo),v_ator,p_request_id,v_payload);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.parcela_reconciliada','chamados',v_c.id,v_payload||jsonb_build_object('clienteId',v_c.cliente_id,'revision',v_rev+1,'requestId',p_request_id,'devolucaoAutorizada',false));
  return jsonb_build_object('parcelaId',p_parcela_id,'revision',v_rev+1,'estado',p_estado,'devolucaoAutorizada',false,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_reconciliar_parcela_humana(uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text) from public,anon,authenticated,service_role;

create or replace function pcm.sso_listar_evidencias_ciclo(p_cliente_id uuid,p_ciclo_id uuid,p_parcela_id uuid,p_apos uuid,p_limite integer)
returns table(evidencia_id uuid,os_id uuid,tipo text,referencia text,descricao text)
language plpgsql volatile security definer set search_path='' as $$
declare v_chamado uuid;
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_conferir_contexto_ciclo_reconciliacao(p_cliente_id,p_ciclo_id,p_parcela_id,false);
  select chamado_id into v_chamado from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id;
  return query select e.id,o.id,e.tipo,e.referencia,e.descricao from pcm.ordens_servico o
    join pcm.retorno_os_preparado r on r.os_id=o.id and r.cliente_id=o.client_id
    join pcm.retorno_evidencias_declaradas e on e.retorno_id=r.id
    where o.chamado_id=v_chamado and o.client_id=p_cliente_id and o.deleted_at is null
      and (select count(*) from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,v_chamado,o.id))=1
      and exists(select 1 from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,v_chamado,o.id) x where x.parcela_id=p_parcela_id)
      and (p_apos is null or e.id>p_apos) order by e.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_evidencias_ciclo(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_reconciliacao_ciclo_os(p_cliente_id uuid,p_ciclo_id uuid,p_parcela_id uuid,p_os_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_chamado uuid;v_parcela pcm.chamado_escopo_parcelas%rowtype;v_s pcm.sso_suspensoes_chamado%rowtype;
  v_i pcm.sso_interrupcoes_parcela%rowtype;v_rev integer;
begin
  if p_os_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pcm.sso_conferir_contexto_ciclo_reconciliacao(p_cliente_id,p_ciclo_id,p_parcela_id,false);
  select chamado_id into v_chamado from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado;
  if not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.chamado_id=v_chamado and o.client_id=p_cliente_id and o.deleted_at is null)
    or (select count(*) from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,v_chamado,p_os_id))<>1
    or not exists(select 1 from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,v_chamado,p_os_id) x where x.parcela_id=p_parcela_id)
    then raise exception 'os_ou_atribuicao_incompativel' using errcode='23514'; end if;
  select * into v_s from pcm.sso_suspensoes_chamado where chamado_id=v_chamado and cliente_id=p_cliente_id;
  select * into v_i from pcm.sso_interrupcoes_parcela where parcela_id=p_parcela_id and os_id=p_os_id and chamado_id=v_chamado and cliente_id=p_cliente_id;
  select coalesce(max(revisao),0) into v_rev from pcm.sso_reconciliacoes_parcela where parcela_id=p_parcela_id;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('parcelaId',p_parcela_id,'situacao',v_parcela.situacao,'revision',v_rev,'osId',p_os_id,
    'suspensao',v_s.estado,'suspensaoRevision',v_s.revisao,'interrupcao',v_i.estado,'interrupcaoRevision',v_i.revisao);
end; $$;
revoke all on function pcm.sso_consultar_reconciliacao_ciclo_os(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
