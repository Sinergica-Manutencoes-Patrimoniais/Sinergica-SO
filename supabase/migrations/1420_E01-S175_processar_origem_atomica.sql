-- ADR-1272: núcleo de processamento privado, gate fechado e contrato sem configuração inicial.
create table pcm.sso_processamento_origem_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_processamento_origem_gate(id,habilitado) values(true,false);
create table pcm.sso_contratos_origem_campo(
  id uuid primary key, integracao text not null check(integracao='auvo'),
  versao text not null check(length(btrim(versao)) between 1 and 100), habilitado boolean not null default false,
  unique(integracao,versao)
);
create table pcm.sso_origem_campo_processamentos(
  integracao text not null, task_id bigint not null, envelope_id uuid not null references pcm.origem_campo_inbox(id),
  contrato_id uuid not null references pcm.sso_contratos_origem_campo(id), cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null references pcm.chamados(id), os_id uuid not null references pcm.ordens_servico(id),
  provisorio boolean not null, motivo text not null, projecao jsonb not null, resultado jsonb not null,
  criado_em timestamptz not null default now(), primary key(integracao,task_id), unique(os_id)
);
alter table pcm.sso_processamento_origem_gate enable row level security;
alter table pcm.sso_processamento_origem_gate force row level security;
alter table pcm.sso_contratos_origem_campo enable row level security;
alter table pcm.sso_contratos_origem_campo force row level security;
alter table pcm.sso_origem_campo_processamentos enable row level security;
alter table pcm.sso_origem_campo_processamentos force row level security;
revoke all on pcm.sso_processamento_origem_gate,pcm.sso_contratos_origem_campo,pcm.sso_origem_campo_processamentos from public,anon,authenticated,service_role;
create trigger sso_origem_campo_processamentos_imutaveis before update or delete on pcm.sso_origem_campo_processamentos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_processar_tarefa_campo_atomica(p_envelope_id uuid,p_contrato_id uuid,p_projecao jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  e pcm.origem_campo_inbox%rowtype; anterior pcm.sso_origem_campo_processamentos%rowtype;
  c pcm.chamados%rowtype; o pcm.ordens_servico%rowtype; cliente uuid; ator uuid;
  cliente_count integer; numero text; titulo text; descricao text; ref_os uuid; ref_chamado uuid;
  estado text; motivo text; provisorio boolean:=false; resultado jsonb;
  tecnico_externo bigint; tecnico uuid; tecnico_count integer;
  agendada timestamptz; entrada timestamptz; saida timestamptz; detalhes jsonb; campo text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if coalesce(auth.role(),'')<>'service_role' or p_envelope_id is null or p_contrato_id is null or jsonb_typeof(p_projecao) is distinct from 'object'
    or (p_projecao - 'titulo' - 'descricao' - 'statusCampo' - 'osExternaId' - 'chamadoId'
      - 'tecnicoAuvoId' - 'dataAgendada' - 'checkIn' - 'checkOut' - 'detalhes' - 'referenciaInvalida' - 'ordemExterna') <> '{}'::jsonb
    or jsonb_typeof(p_projecao->'referenciaInvalida') is distinct from 'boolean'
    or coalesce(p_projecao->>'ordemExterna','') !~ '^[1-9][0-9]{0,17}$' then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  perform 1 from pcm.sso_processamento_origem_gate where id and habilitado for share;
  if not found then raise exception 'processamento_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.origem_campo_inbox_gate where id and habilitado for share;
  if not found then raise exception 'inbox_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_contratos_origem_campo where id=p_contrato_id and integracao='auvo' and habilitado for share;
  if not found then raise exception 'contrato_nao_habilitado' using errcode='55000'; end if;
  select * into e from pcm.origem_campo_inbox where id=p_envelope_id and integracao='auvo' for update;
  if not found then raise exception 'envelope_indisponivel' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-origem-campo-tarefa:'||e.task_id::text,0));
  select * into anterior from pcm.sso_origem_campo_processamentos where integracao='auvo' and task_id=e.task_id;
  if found then
    if not exists(select 1 from pcm.clientes where id=anterior.cliente_id and deleted_at is null and auvo_id::text=e.cliente_externo_id) then
      return jsonb_build_object('estado','pendente','motivo','cliente_atual_divergente','envelopeId',e.id,'eventoAplicado',false);
    end if;
    -- Eventos posteriores não são descartados da inbox, mas tampouco atualizam a OS aqui.
    return anterior.resultado || jsonb_build_object('envelopeId',e.id,'reutilizado',true,'eventoAplicado',false);
  end if;
  select count(*),min(id::text)::uuid into cliente_count,cliente from pcm.clientes where auvo_id::text=e.cliente_externo_id and deleted_at is null;
  if cliente_count<>1 then return jsonb_build_object('estado','pendente','motivo','cliente_nao_resolvido','envelopeId',e.id,'eventoAplicado',false); end if;
  titulo:=nullif(btrim(p_projecao->>'titulo'),''); descricao:=nullif(btrim(p_projecao->>'descricao'),''); estado:=p_projecao->>'statusCampo';
  if titulo is null or length(titulo)>200 or length(coalesce(descricao,''))>10000 or estado not in ('aberta','em_andamento','concluida') or estado is null then
    raise exception 'projecao_invalida' using errcode='22023';
  end if;
  if p_projecao->>'osExternaId' is not null and p_projecao->>'osExternaId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'identidade_os_invalida' using errcode='22023'; end if;
  if p_projecao->>'chamadoId' is not null and p_projecao->>'chamadoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'identidade_chamado_invalida' using errcode='22023'; end if;
  ref_os:=nullif(p_projecao->>'osExternaId','')::uuid; ref_chamado:=nullif(p_projecao->>'chamadoId','')::uuid;
  if p_projecao->'referenciaInvalida'='true'::jsonb and (ref_os is not null or ref_chamado is not null) then
    return jsonb_build_object('estado','pendente','motivo','referencias_incompativeis','envelopeId',e.id,'eventoAplicado',false);
  end if;
  if p_projecao->>'tecnicoAuvoId' is not null then
    if p_projecao->>'tecnicoAuvoId' !~ '^[1-9][0-9]{0,17}$' then raise exception 'tecnico_invalido' using errcode='22023'; end if;
    tecnico_externo:=(p_projecao->>'tecnicoAuvoId')::bigint;
    select count(*),min(f.id::text)::uuid into tecnico_count,tecnico from pcm.funcionarios f
      where f.auvo_user_id=tecnico_externo and f.deleted_at is null;
    if tecnico_count>1 then raise exception 'tecnico_ambiguo' using errcode='23514'; end if;
  end if;
  foreach campo in array array['dataAgendada','checkIn','checkOut'] loop
    if p_projecao->>campo is not null and p_projecao->>campo !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' then
      raise exception 'instante_invalido' using errcode='22023';
    end if;
  end loop;
  agendada:=nullif(p_projecao->>'dataAgendada','')::timestamptz;
  entrada:=nullif(p_projecao->>'checkIn','')::timestamptz;
  saida:=nullif(p_projecao->>'checkOut','')::timestamptz;
  if (agendada is not null and not isfinite(agendada)) or (entrada is not null and not isfinite(entrada))
    or (saida is not null and not isfinite(saida)) or (entrada is not null and saida is not null and saida<entrada) then
    raise exception 'instantes_incompativeis' using errcode='22023';
  end if;
  detalhes:=p_projecao->'detalhes';
  if detalhes is not null and detalhes <> 'null'::jsonb and (jsonb_typeof(detalhes) is distinct from 'object' or octet_length(detalhes::text)>196608) then
    raise exception 'detalhes_invalidos' using errcode='22023';
  end if;
  if detalhes='null'::jsonb then detalhes:=null; end if;
  select * into o from pcm.ordens_servico where auvo_task_id=e.task_id and deleted_at is null for update;
  if found then
    if o.client_id is distinct from cliente or o.chamado_id is null or (ref_os is not null and ref_os is distinct from o.id)
      or (ref_chamado is not null and ref_chamado is distinct from o.chamado_id) then
      return jsonb_build_object('estado','pendente','motivo','os_existente_exige_triagem','envelopeId',e.id,'eventoAplicado',false);
    end if;
    select * into c from pcm.chamados where id=o.chamado_id and cliente_id=cliente and deleted_at is null for share;
    if not found then return jsonb_build_object('estado','pendente','motivo','chamado_existente_indisponivel','envelopeId',e.id,'eventoAplicado',false); end if;
    motivo:='os_existente';
  elsif ref_os is not null then
    select * into o from pcm.ordens_servico where id=ref_os and client_id=cliente and deleted_at is null for update;
    if not found or o.chamado_id is null or (o.auvo_task_id is not null and o.auvo_task_id<>e.task_id)
      or (ref_chamado is not null and ref_chamado is distinct from o.chamado_id) then
      return jsonb_build_object('estado','pendente','motivo','identidade_os_exige_triagem','envelopeId',e.id,'eventoAplicado',false);
    end if;
    select * into c from pcm.chamados where id=o.chamado_id and cliente_id=cliente and deleted_at is null for share;
    if not found then return jsonb_build_object('estado','pendente','motivo','chamado_existente_indisponivel','envelopeId',e.id,'eventoAplicado',false); end if;
    update pcm.ordens_servico set auvo_task_id=e.task_id,auvo_sync_status='synced',auvo_synced_at=now() where id=o.id returning * into o;
    motivo:='os_externa_identificada';
  else
    if ref_chamado is not null then
      select * into c from pcm.chamados where id=ref_chamado and cliente_id=cliente and deleted_at is null and status in ('aberto','convertido_os') and sso_encerrado_em is null for update;
    end if;
    if c.id is null then
      provisorio:=true; motivo:=case when ref_chamado is null and p_projecao->'referenciaInvalida'='false'::jsonb then 'referencia_ausente' else 'referencia_invalida_ou_outro_cliente' end;
    else motivo:='referencia_chamado'; end if;
    -- Cardinalidade e numeração legadas precisam ser migradas antes deste caminho.
    if pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is not null or exists(select 1 from pg_catalog.pg_trigger where tgrelid='pcm.ordens_servico'::regclass and tgname='trg_ordens_servico_numero_chamado' and not tgisinternal) then
      raise exception 'transicao_legada_incompleta' using errcode='55000';
    end if;
    select u.user_id into ator from config.usuarios u where u.ativo and u.papel in ('superadmin','supervisor') order by u.papel,u.created_at,u.user_id limit 1;
    if ator is null then raise exception 'ator_sistema_indisponivel' using errcode='55000'; end if;
    if provisorio then
      numero:=pcm.fn_proximo_numero_chamado();
      insert into pcm.chamados(cliente_id,numero,titulo,descricao,origem,created_by,updated_by)
        values(cliente,numero,titulo,descricao,'auvo_sync',ator,ator) returning * into c;
      insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(c.id,'criado',jsonb_build_object('origemCampo',true,'provisorio',true,'motivo',motivo),ator);
    end if;
    o.id:=gen_random_uuid(); numero:=c.numero||'-OS-'||o.id::text;
    insert into pcm.ordens_servico(id,client_id,chamado_id,numero,titulo,descricao,categoria,status,origem,origem_ref_id,auvo_task_id,auvo_sync_status,auvo_synced_at,created_by,
      tecnico_auvo_user_id,tecnico_funcionario_id,data_agendada,check_in_at,check_out_at,auvo_detalhes)
      values(o.id,cliente,c.id,numero,titulo,descricao,'corretiva',case when estado='aberta' then 'solicitacao' else 'em_execucao' end,'auvo',e.task_id::text,e.task_id,'synced',now(),ator,
        tecnico_externo,tecnico,agendada,entrada,saida,detalhes) returning * into o;
    update pcm.chamados set ordem_servico_id=coalesce(ordem_servico_id,o.id),status='convertido_os',updated_at=now(),updated_by=ator where id=c.id;
    insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(c.id,'os_gerada',jsonb_build_object('ordemServicoId',o.id,'origemCampo',true),ator);
  end if;
  resultado:=jsonb_build_object('estado','processado','envelopeId',e.id,'clienteId',cliente,'chamadoId',c.id,'osId',o.id,'taskId',e.task_id::text,
    'provisorio',provisorio,'motivo',motivo,'statusCampo',estado,'validacaoPcmComprovada',false,'fotosImportadas',false,'reutilizado',false,'eventoAplicado',true);
  insert into pcm.sso_origem_campo_processamentos(integracao,task_id,envelope_id,contrato_id,cliente_id,chamado_id,os_id,provisorio,motivo,projecao,resultado)
    values('auvo',e.task_id,e.id,p_contrato_id,cliente,c.id,o.id,provisorio,motivo,p_projecao,resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'origem_campo.tarefa_processada','ordens_servico',o.id,resultado);
  return resultado;
end; $$;
revoke all on function pcm.sso_processar_tarefa_campo_atomica(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
