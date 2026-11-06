-- ADR-1040: registro declarado; não é cálculo oficial de capacidade.
create table pcm.sso_alertas_reprogramacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_alertas_reprogramacao_gate(id,habilitado) values(true,false);
create table pcm.sso_alertas_reprogramacao_comandos(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  visita_id uuid not null references pcm.visitas(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_alertas_reprogramacao_gate enable row level security;
alter table pcm.sso_alertas_reprogramacao_gate force row level security;
alter table pcm.sso_alertas_reprogramacao_comandos enable row level security;
alter table pcm.sso_alertas_reprogramacao_comandos force row level security;
revoke all on pcm.sso_alertas_reprogramacao_gate,pcm.sso_alertas_reprogramacao_comandos from public,anon,authenticated,service_role;
create trigger sso_alertas_reprogramacao_comandos_imutaveis before update or delete on pcm.sso_alertas_reprogramacao_comandos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_reprogramar_visita_alertas_declarados(
  p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_visita_id uuid,p_revision integer,
  p_inicio timestamptz,p_fim timestamptz,p_motivo text,p_vencimento_declarado date,p_alertas jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ant pcm.sso_alertas_reprogramacao_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_nucleo jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_visita_id is null
    or p_revision is null or p_revision<1 or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<=p_inicio
    or p_vencimento_declarado is null or not isfinite(p_vencimento_declarado) or v_motivo is null or length(v_motivo)>2000
    or pg_catalog.jsonb_typeof(p_alertas) is distinct from 'array' or pg_catalog.octet_length(p_alertas::text)>2048 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if pg_catalog.jsonb_array_length(p_alertas)>7 or exists(select 1 from pg_catalog.jsonb_array_elements(p_alertas) a where pg_catalog.jsonb_typeof(a) is distinct from 'string'
    or (a #>> '{}') not in ('capacidade_nao_verificada','sobrecarga','simultaneidade_incompativel','qualificacao_incompativel','conflito','equipe_nao_verificada'))
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_alertas) a group by a having count(*)>1) then raise exception 'alertas_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_alertas_reprogramacao_gate where id and habilitado for share;
  if not found then raise exception 'alertas_reprogramacao_desabilitados' using errcode='55000'; end if;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'visitaId',p_visita_id,'revision',p_revision,'inicio',p_inicio,'fim',p_fim,
    'motivo',v_motivo,'vencimentoDeclarado',p_vencimento_declarado,'alertas',p_alertas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-alertas:'||p_request_id::text,0));
  -- Obter a trava compartilhada com o comando proprietário antes da linha da Visita.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_alertas_reprogramacao_comandos where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  if exists(select 1 from pcm.visita_comandos where request_id=p_request_id) then raise exception 'pedido_sem_recibo_alertas' using errcode='23505'; end if;
  perform 1 from pcm.visitas v where v.id=p_visita_id and v.cliente_id=p_cliente_id for update;
  if not found then raise exception 'visita_indisponivel' using errcode='42501'; end if;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_nucleo:=pcm.sso_transicionar_visita_mediada(p_request_id,p_visita_id,p_revision,'reprogramar',p_inicio,p_fim,v_motivo);
  if v_nucleo->>'requestId' is distinct from p_request_id::text or v_nucleo->>'aggregateId' is distinct from p_visita_id::text
    or (v_nucleo->>'revision')::integer is distinct from p_revision+1 then raise exception 'recibo_invalido' using errcode='23514'; end if;
  v_resultado:=v_nucleo||jsonb_build_object('clienteId',p_cliente_id,'vencimentoDeclarado',p_vencimento_declarado,'alertasDeclarados',p_alertas,
    'capacidadeComprovada',false,'vencimentoComprovado',false,'tarefaAuvoAlterada',false);
  insert into pcm.sso_alertas_reprogramacao_comandos(request_id,ator_id,cliente_id,visita_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,p_visita_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'visita.alertas_declarados','visitas',p_visita_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'vencimentoDeclarado',p_vencimento_declarado,'alertas',p_alertas,'motivo',v_motivo));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_reprogramar_visita_alertas_declarados(uuid,uuid,uuid,uuid,integer,timestamptz,timestamptz,text,date,jsonb) from public,anon,authenticated,service_role;
