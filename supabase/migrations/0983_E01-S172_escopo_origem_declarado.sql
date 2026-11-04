-- ADR-0781: declaração privada, não comprova execução nem altera a origem.
create table pcm.sso_escopo_origem_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_escopo_origem_gate enable row level security;
alter table pcm.sso_escopo_origem_gate force row level security;
revoke all on pcm.sso_escopo_origem_gate from public,anon,authenticated,service_role;
insert into pcm.sso_escopo_origem_gate(id,habilitado) values(true,false);

create table pcm.sso_escopo_origem_declaracoes(
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),os_id uuid not null references pcm.ordens_servico(id),
 revisao integer not null check(revisao>0), origem jsonb not null,executado_declarado text,restante_declarado text,
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),
 ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),
 check(executado_declarado is not null or restante_declarado is not null), unique(os_id,revisao)
);
alter table pcm.sso_escopo_origem_declaracoes enable row level security;
alter table pcm.sso_escopo_origem_declaracoes force row level security;
revoke all on pcm.sso_escopo_origem_declaracoes from public,anon,authenticated,service_role;
create trigger escopo_origem_imutavel before update or delete on pcm.sso_escopo_origem_declaracoes
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_declarar_escopo_origem(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_expected_revision integer,
 p_executado text,p_restante text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_os pcm.ordens_servico%rowtype;v_ant pcm.sso_escopo_origem_declaracoes%rowtype;
 v_payload jsonb;v_origem jsonb;v_rev integer;v_exec text:=nullif(btrim(p_executado),'');v_rest text:=nullif(btrim(p_restante),'');v_motivo text:=nullif(btrim(p_justificativa),'');
begin
 perform 1 from pcm.sso_escopo_origem_gate where id for share;
 perform 1 from pcm.sso_origem_execucao_unificada_gate where id for share;
 if not coalesce((select habilitado from pcm.sso_escopo_origem_gate where id),false) then raise exception 'escopo_origem_bloqueado' using errcode='55000';end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_autorizacao_incompativel' using errcode='25001';end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_expected_revision is null or p_expected_revision<0
   or (v_exec is null and v_rest is null) or length(v_exec)>4000 or length(v_rest)>4000 or v_motivo is null or length(v_motivo)>2000 then
   raise exception 'declaracao_invalida' using errcode='22023';end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_os from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found or v_os.ocorrencia_preventiva_id is null then raise exception 'origem_indisponivel' using errcode='23514';end if;
 v_origem:=pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'expectedRevision',p_expected_revision,'executado',v_exec,'restante',v_rest,'justificativa',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('escopo-origem-request:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_escopo_origem_declaracoes where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload or v_ant.origem is distinct from v_origem then raise exception 'request_id_conflitante' using errcode='23505';end if;
  return jsonb_build_object('requestId',p_request_id,'revision',v_ant.revisao,'execucaoComprovada',false);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('escopo-origem-os:'||p_os_id::text,0));
 select coalesce(max(revisao),0) into v_rev from pcm.sso_escopo_origem_declaracoes where os_id=p_os_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 insert into pcm.sso_escopo_origem_declaracoes(request_id,cliente_id,os_id,revisao,origem,executado_declarado,restante_declarado,justificativa,ator_id,payload)
 values(p_request_id,p_cliente_id,p_os_id,v_rev+1,v_origem,v_exec,v_rest,v_motivo,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'execucao.escopo_origem_declarado','ordens_servico',p_os_id,
  jsonb_build_object('requestId',p_request_id,'revision',v_rev+1,'origem',v_origem,'execucaoComprovada',false));
 return jsonb_build_object('requestId',p_request_id,'revision',v_rev+1,'execucaoComprovada',false);
end; $$;
revoke all on function pcm.sso_declarar_escopo_origem(uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
