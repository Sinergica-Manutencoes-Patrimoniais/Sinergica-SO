-- ADR-1301: somente o servidor emite novas reservas canceláveis.
create table pcm.sso_reserva_recepcao_manual_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reserva_recepcao_manual_gate(id,habilitado) values(true,false);
alter table pcm.sso_reserva_recepcao_manual_gate enable row level security;
alter table pcm.sso_reserva_recepcao_manual_gate force row level security;
revoke all on pcm.sso_reserva_recepcao_manual_gate from public,anon,authenticated,service_role;
create table pcm.sso_reservas_recepcao_manual(request_id uuid primary key,ator_id uuid not null,cliente_id uuid not null,
 payload jsonb not null,criado_em timestamptz not null default clock_timestamp());
alter table pcm.sso_reservas_recepcao_manual enable row level security;
alter table pcm.sso_reservas_recepcao_manual force row level security;
revoke all on pcm.sso_reservas_recepcao_manual from public,anon,authenticated,service_role;

create function pcm.sso_reservar_recepcao_manual(p_ator_id uuid,p_cliente_id uuid,p_origem_declarada text,p_chave_origem text,p_linhas jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_request uuid:=pg_catalog.gen_random_uuid(); v_payload jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
   or (p_origem_declarada is not null and p_origem_declarada not in ('planilha','auvo','campo'))
   or p_chave_origem is null or length(btrim(p_chave_origem)) not between 1 and 200
   or jsonb_typeof(p_linhas) is distinct from 'array' or octet_length(p_linhas::text)>1048576
   then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_reserva_recepcao_manual_gate where id and habilitado for share;
 if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'origem','manual','origemDeclarada',p_origem_declarada,'chaveOrigem',p_chave_origem,'linhas',p_linhas);
 insert into pcm.sso_reservas_recepcao_manual(request_id,ator_id,cliente_id,payload) values(v_request,p_ator_id,p_cliente_id,v_payload);
 return jsonb_build_object('requestId',v_request,'clienteId',p_cliente_id,'criaLote',false);
end; $$;
revoke all on function pcm.sso_reservar_recepcao_manual(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reservar_recepcao_manual(uuid,uuid,text,text,jsonb) to authenticated;

create or replace function pcm.sso_cancelar_recepcao_manual(
  p_ator_id uuid, p_cliente_id uuid, p_request_id uuid,
  p_origem_declarada text, p_chave_origem text, p_linhas jsonb, p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_comando pcm.sso_levantamento_comandos%rowtype;
  v_cancelamento pcm.sso_recepcao_manual_cancelamentos%rowtype;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null
    or (p_origem_declarada is not null and p_origem_declarada not in ('planilha','auvo','campo'))
    or p_chave_origem is null or length(btrim(p_chave_origem)) not between 1 and 200
    or jsonb_typeof(p_linhas) is distinct from 'array' or octet_length(p_linhas::text) > 1048576
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_recepcao_manual_cancelamento_gate where id and habilitado for share;
  if not found then raise exception 'cancelamento_desabilitado' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload := jsonb_build_object('clienteId',p_cliente_id,'origem','manual','origemDeclarada',p_origem_declarada,'chaveOrigem',p_chave_origem,'linhas',p_linhas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_comando from pcm.sso_levantamento_comandos where request_id=p_request_id;
  if found then
    if v_comando.ator_id is distinct from p_ator_id or v_comando.payload is distinct from v_payload
      or not exists(select 1 from pcm.sso_levantamentos l where l.id::text=v_comando.resultado->>'aggregateId' and l.cliente_id=p_cliente_id)
      then raise exception 'pedido_indisponivel' using errcode='42501'; end if;
    return jsonb_build_object('estado','recebido','requestId',p_request_id,'resultado',v_comando.resultado);
  end if;
  if not exists(select 1 from pcm.sso_reservas_recepcao_manual r where r.request_id=p_request_id and r.ator_id=p_ator_id and r.cliente_id=p_cliente_id and r.payload=v_payload) then
    raise exception 'titularidade_nao_comprovada' using errcode='42501';
  end if;
  select * into v_cancelamento from pcm.sso_recepcao_manual_cancelamentos where request_id=p_request_id;
  if found then
    if v_cancelamento.ator_id is distinct from p_ator_id or v_cancelamento.cliente_id is distinct from p_cliente_id
      or v_cancelamento.payload is distinct from v_payload or v_cancelamento.motivo is distinct from btrim(p_motivo)
      then raise exception 'pedido_indisponivel' using errcode='42501'; end if;
  else
    insert into pcm.sso_recepcao_manual_cancelamentos(request_id,ator_id,cliente_id,payload,motivo)
      values(p_request_id,p_ator_id,p_cliente_id,v_payload,btrim(p_motivo));
    insert into audit.events(actor_id,action,entity,entity_id,payload)
      values(p_ator_id,'levantamento.recepcao_cancelada','sso_recepcao_manual_cancelamentos',p_request_id,
        jsonb_build_object('clienteId',p_cliente_id,'motivo',btrim(p_motivo)));
  end if;
  return jsonb_build_object('estado','cancelado','requestId',p_request_id);
end; $$;

create or replace function pcm.sso_receber_levantamento_manual(
  p_request_id uuid, p_cliente_id uuid, p_origem_declarada text, p_chave_origem text, p_linhas jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_origem text := 'manual';
  v_payload jsonb;
  v_comando pcm.sso_levantamento_comandos%rowtype;
  v_lote pcm.sso_levantamentos%rowtype;
  v_linha jsonb;
  v_resultado jsonb;
  v_novo boolean := false;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is not true then raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if p_request_id is null or p_cliente_id is null or (p_origem_declarada is not null and p_origem_declarada not in ('planilha', 'auvo', 'campo')) or p_chave_origem is null or length(btrim(p_chave_origem)) not between 1 and 200
    or p_linhas is null then
    raise exception 'recepcao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'origem', v_origem,
    'origemDeclarada', p_origem_declarada, 'chaveOrigem', p_chave_origem, 'linhas', p_linhas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  if exists (select 1 from pcm.sso_reservas_recepcao_manual r where r.request_id=p_request_id and (r.ator_id is distinct from v_ator or r.cliente_id is distinct from p_cliente_id or r.payload is distinct from v_payload)) then
    raise exception 'reserva_divergente' using errcode='42501';
  end if;
  if exists (select 1 from pcm.sso_recepcao_manual_cancelamentos x where x.request_id = p_request_id) then
    raise exception 'recepcao_cancelada' using errcode = '55000';
  end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is not true then raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_comando from pcm.sso_levantamento_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or octet_length(p_linhas::text) > 1048576 then
    raise exception 'linhas_invalidas' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'quantidade_linhas_invalida' using errcode = '22023';
  end if;
  for v_linha in select value from jsonb_array_elements(p_linhas) loop
    if jsonb_typeof(v_linha) is distinct from 'object'
       or (v_linha - 'chave' - 'tipo' - 'atributos') <> '{}'::jsonb
       or jsonb_typeof(v_linha->'chave') is distinct from 'string'
       or length(btrim(v_linha->>'chave')) not between 1 and 200
       or jsonb_typeof(v_linha->'tipo') is distinct from 'string'
       or v_linha->>'tipo' not in ('area','local','sublocal','sistema','equipamento','componente','grupo_quantitativo')
       or jsonb_typeof(v_linha->'atributos') is distinct from 'object'
       or octet_length(v_linha::text) > 32768 then
      raise exception 'linha_invalida' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_each(v_linha->'atributos') a
      where a.key not in ('nome','observacoes','quantidade','codigoInformado','referenciaPai','sistemaProvisorio','localProvisorio','classificacao')
        or jsonb_typeof(a.value) not in ('string','number','boolean','null')
        or (jsonb_typeof(a.value) = 'string' and length(a.value #>> '{}') > 4000)) then
      raise exception 'atributos_invalidos' using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_linhas) l group by l->>'chave' having count(*) > 1) then
    raise exception 'chave_linha_duplicada' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array(p_cliente_id, v_origem, p_chave_origem)::text, 0));
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is not true then raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_lote from pcm.sso_levantamentos
    where cliente_id = p_cliente_id and origem = v_origem and chave_origem = p_chave_origem;
  if found then
    if v_lote.conteudo is distinct from p_linhas or v_lote.origem_declarada is distinct from p_origem_declarada then
      raise exception 'origem_conflitante' using errcode = '23505';
    end if;
  else
    insert into pcm.sso_levantamentos(cliente_id, origem, origem_declarada, meio_recepcao, chave_origem, conteudo, criado_por)
      values (p_cliente_id, v_origem, p_origem_declarada, 'manual', p_chave_origem, p_linhas, v_ator) returning * into v_lote;
    insert into pcm.sso_levantamento_linhas(lote_id, chave, tipo, atributos)
      select v_lote.id, l->>'chave', l->>'tipo', l->'atributos' from jsonb_array_elements(p_linhas) l;
    insert into audit.events(actor_id, action, entity, entity_id, payload)
      values (v_ator, 'levantamento.recebido', 'sso_levantamentos', v_lote.id,
        jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'origem', v_origem,
          'quantidadeLinhas', jsonb_array_length(p_linhas), 'revision', 1));
    v_novo := true;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_lote.id, 'revision', v_lote.revisao,
    'state', 'pendente', 'created', v_novo, 'linkedIds', '{}'::jsonb,
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.sso_levantamento_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;




