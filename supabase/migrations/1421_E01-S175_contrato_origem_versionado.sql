-- ADR-1273: contratos privados, sem gates abertos ou configuração inicial.
alter table pcm.sso_contratos_origem_campo add column definicao jsonb not null default '{}'::jsonb;
alter table pcm.sso_contratos_origem_campo add column criado_por uuid references auth.users(id);
alter table pcm.sso_contratos_origem_campo add column motivo text;
alter table pcm.sso_contratos_origem_campo add column evidencia text;
create table pcm.sso_contrato_origem_admin_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_contrato_origem_admin_gate(id,habilitado) values(true,false);
create table pcm.sso_contrato_origem_comandos(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),contrato_id uuid not null references pcm.sso_contratos_origem_campo(id),
  payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_contrato_origem_admin_gate enable row level security;
alter table pcm.sso_contrato_origem_admin_gate force row level security;
alter table pcm.sso_contrato_origem_comandos enable row level security;
alter table pcm.sso_contrato_origem_comandos force row level security;
revoke all on pcm.sso_contrato_origem_admin_gate,pcm.sso_contrato_origem_comandos from public,anon,authenticated,service_role;
create trigger sso_contrato_origem_comandos_imutaveis before update or delete on pcm.sso_contrato_origem_comandos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_guardar_definicao_contrato_origem() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' or new.id is distinct from old.id or new.integracao is distinct from old.integracao or new.versao is distinct from old.versao
    or new.definicao is distinct from old.definicao or new.criado_por is distinct from old.criado_por or new.motivo is distinct from old.motivo
    or new.evidencia is distinct from old.evidencia then raise exception 'contrato_imutavel' using errcode='23514'; end if;
  return new;
end; $$;
revoke all on function pcm.sso_guardar_definicao_contrato_origem() from public,anon,authenticated,service_role;
create trigger sso_contrato_origem_definicao_imutavel before update or delete on pcm.sso_contratos_origem_campo
  for each row execute function pcm.sso_guardar_definicao_contrato_origem();

create function pcm.sso_cadastrar_contrato_origem(p_ator_id uuid,p_request_id uuid,p_contrato_id uuid,p_versao text,p_definicao jsonb,p_motivo text,p_evidencia text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_contrato_origem_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_contrato_id is null
    or length(btrim(coalesce(p_versao,''))) not between 1 and 100 or p_versao<>btrim(p_versao)
    or length(btrim(coalesce(p_motivo,''))) not between 1 and 2000 or length(btrim(coalesce(p_evidencia,''))) not between 1 and 2000
    or jsonb_typeof(p_definicao) is distinct from 'object' or octet_length(p_definicao::text)>65536
    or (p_definicao-'campos'-'estados'-'fuso')<>'{}'::jsonb
    or jsonb_typeof(p_definicao->'campos') is distinct from 'object' or jsonb_typeof(p_definicao->'estados') is distinct from 'object'
    or jsonb_typeof(p_definicao->'fuso') is distinct from 'string' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not ((p_definicao->'campos') ?& array['taskId','clienteId','titulo','status','ordem'])
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_definicao->>'fuso')
    or exists(select 1 from jsonb_each(p_definicao->'campos') x where x.key not in ('taskId','clienteId','titulo','status','ordem','descricao','osExternaId','chamadoId','tecnicoId','dataAgendada','checkIn','checkOut','detalhes')
      or jsonb_typeof(x.value) is distinct from 'string' or x.value #>> '{}' !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$')
    or exists(select 1 from jsonb_each_text(p_definicao->'campos') x group by x.value having count(*)>1)
    or (p_definicao->'estados')='{}'::jsonb
    or exists(select 1 from jsonb_each(p_definicao->'estados') x where length(x.key) not between 1 and 100
      or jsonb_typeof(x.value) is distinct from 'string' or x.value #>> '{}' not in ('aberta','em_andamento','concluida')) then
    raise exception 'definicao_invalida' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_contrato_origem_admin_gate where id and habilitado for share;
  if not found then raise exception 'administracao_desabilitada' using errcode='55000'; end if;
  if coalesce(auth.jwt()->>'user_role','')<>'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('tipo','cadastro','contratoId',p_contrato_id,'versao',p_versao,'definicao',p_definicao,'motivo',btrim(p_motivo),'evidencia',btrim(p_evidencia));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-contrato-origem:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_contrato_origem_comandos where request_id=p_request_id;
  if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
  insert into pcm.sso_contratos_origem_campo(id,integracao,versao,habilitado,definicao,criado_por,motivo,evidencia)
    values(p_contrato_id,'auvo',p_versao,false,p_definicao,p_ator_id,btrim(p_motivo),btrim(p_evidencia));
  v_resultado:=jsonb_build_object('requestId',p_request_id,'contratoId',p_contrato_id,'habilitado',false,'contratoComprovado',false);
  insert into pcm.sso_contrato_origem_comandos(request_id,ator_id,contrato_id,payload,resultado) values(p_request_id,p_ator_id,p_contrato_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'origem_campo.contrato_cadastrado','sso_contratos_origem_campo',p_contrato_id,jsonb_build_object('requestId',p_request_id,'versao',p_versao,'motivo',btrim(p_motivo),'evidencia',btrim(p_evidencia)));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_cadastrar_contrato_origem(uuid,uuid,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_alterar_contrato_origem(p_ator_id uuid,p_request_id uuid,p_contrato_id uuid,p_anterior boolean,p_habilitar boolean,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_contrato_origem_comandos%rowtype; v_contrato pcm.sso_contratos_origem_campo%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_contrato_id is null or p_anterior is null or p_habilitar is null
    or p_anterior=p_habilitar or length(btrim(coalesce(p_motivo,''))) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_contrato_origem_admin_gate where id and habilitado for share;
  if not found then raise exception 'administracao_desabilitada' using errcode='55000'; end if;
  if coalesce(auth.jwt()->>'user_role','')<>'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('tipo','estado','contratoId',p_contrato_id,'anterior',p_anterior,'habilitar',p_habilitar,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-contrato-origem:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_contrato_origem_comandos where request_id=p_request_id;
  if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
  select * into v_contrato from pcm.sso_contratos_origem_campo where id=p_contrato_id for update;
  if not found or v_contrato.habilitado is distinct from p_anterior then raise exception 'contrato_alterado_ou_indisponivel' using errcode='40001'; end if;
  if p_habilitar and (v_contrato.definicao='{}'::jsonb or v_contrato.criado_por is null or v_contrato.evidencia is null) then raise exception 'contrato_incompleto' using errcode='23514'; end if;
  update pcm.sso_contratos_origem_campo set habilitado=p_habilitar where id=p_contrato_id;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'contratoId',p_contrato_id,'habilitado',p_habilitar,'comprovacaoAutomatica',false);
  insert into pcm.sso_contrato_origem_comandos(request_id,ator_id,contrato_id,payload,resultado) values(p_request_id,p_ator_id,p_contrato_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'origem_campo.contrato_estado_alterado','sso_contratos_origem_campo',p_contrato_id,jsonb_build_object('requestId',p_request_id,'habilitado',p_habilitar,'motivo',btrim(p_motivo)));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_alterar_contrato_origem(uuid,uuid,uuid,boolean,boolean,text) from public,anon,authenticated,service_role;

create function pcm.sso_ler_envelope_contrato_origem(p_envelope_id uuid,p_contrato_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e pcm.origem_campo_inbox%rowtype; c pcm.sso_contratos_origem_campo%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_envelope_id is null or p_contrato_id is null then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
  perform 1 from pcm.origem_campo_inbox_gate where id and habilitado for share;
  if not found then raise exception 'inbox_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_processamento_origem_gate where id and habilitado for share;
  if not found then raise exception 'processamento_desabilitado' using errcode='55000'; end if;
  select * into e from pcm.origem_campo_inbox where id=p_envelope_id and integracao='auvo' for share;
  if not found then raise exception 'envelope_indisponivel' using errcode='22023'; end if;
  select * into c from pcm.sso_contratos_origem_campo where id=p_contrato_id and integracao=e.integracao and habilitado for share;
  if not found then raise exception 'contrato_indisponivel' using errcode='55000'; end if;
  return jsonb_build_object('envelope',jsonb_build_object('id',e.id,'taskId',e.task_id::text,'clienteExternoId',e.cliente_externo_id,'payload',e.payload),
    'contrato',jsonb_build_object('id',c.id,'versao',c.versao,'campos',c.definicao->'campos','estados',c.definicao->'estados','fuso',c.definicao->'fuso','habilitado',true));
end; $$;
revoke all on function pcm.sso_ler_envelope_contrato_origem(uuid,uuid) from public,anon,authenticated,service_role;
