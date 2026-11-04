-- ADR-1468: conferência explícita, gate fechado; não altera status ou validação PCM.
create table pcm.sso_conferencia_evento_campo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_evento_campo_gate(id,habilitado) values(true,false);
create table pcm.sso_conferencia_evento_campo_tokens(
 txid bigint not null,ator_id uuid not null,envelope_id uuid not null,ordem bigint not null,revisao bigint not null,
 primary key(txid,ator_id,envelope_id,ordem)
);
create table pcm.sso_conferencias_evento_campo(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 os_id uuid not null references pcm.ordens_servico(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_conferencia_evento_campo_gate enable row level security;
alter table pcm.sso_conferencia_evento_campo_gate force row level security;
alter table pcm.sso_conferencia_evento_campo_tokens enable row level security;
alter table pcm.sso_conferencia_evento_campo_tokens force row level security;
alter table pcm.sso_conferencias_evento_campo enable row level security;
alter table pcm.sso_conferencias_evento_campo force row level security;
revoke all on pcm.sso_conferencia_evento_campo_gate,pcm.sso_conferencia_evento_campo_tokens,pcm.sso_conferencias_evento_campo from public,anon,authenticated,service_role;
create trigger sso_conferencias_evento_campo_imutaveis before update or delete on pcm.sso_conferencias_evento_campo
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Somente token privado emitido nesta transação permite a entrada autenticada e
-- a revisão explicitamente conferida; o caminho de serviço continua igual.
do $migration$
declare
 f regprocedure:='pcm.sso_aplicar_evento_origem_campo(uuid,bigint)'::regprocedure;
 d text:=pg_catalog.pg_get_functiondef(f);
 a text:=$old$auth.role() is distinct from 'service_role' or p_envelope_id is null$old$;
 b text:=$new$(auth.role() is distinct from 'service_role' and not exists(select 1 from pcm.sso_conferencia_evento_campo_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=auth.uid() and t.envelope_id=p_envelope_id and t.ordem=p_ordem)) or p_envelope_id is null$new$;
 c text:=$old$if v.revisao<>v.revisao_aplicada then$old$;
 x text:=$old$auvo_detalhes=nullif(ev.projecao->'detalhes','null'::jsonb)$old$;
 y text:=$new$auvo_detalhes=case when auth.role()='service_role' then nullif(ev.projecao->'detalhes','null'::jsonb) else auvo_detalhes end$new$;
 e text:=$new$if v.revisao<>v.revisao_aplicada and not exists(select 1 from pcm.sso_conferencia_evento_campo_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=auth.uid() and t.envelope_id=p_envelope_id and t.ordem=p_ordem and t.revisao=v.revisao) then$new$;
begin
 if length(d)-length(replace(d,a,''))<>length(a) or length(d)-length(replace(d,c,''))<>length(c) or length(d)-length(replace(d,x,''))<>length(x) then raise exception 'definicao_aplicacao_incompativel' using errcode='55000'; end if;
 d:=replace(replace(replace(d,a,b),c,e),x,y); execute d;
end; $migration$;

create function pcm.sso_previa_conferencia_evento_campo(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r record;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_conferencia_evento_campo_gate where id and habilitado for share;
 if not found then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select o.id, o.titulo, o.descricao, o.tecnico_auvo_user_id, o.tecnico_funcionario_id, o.data_agendada, o.check_in_at, o.check_out_at,
   v.revisao, v.ultima_ordem, ev.envelope_id, ev.ordem_externa, ev.projecao
 into r from pcm.sso_origem_campo_processamentos p
 join pcm.ordens_servico o on o.id=p.os_id and o.client_id=p_cliente_id and o.auvo_task_id=p.task_id and o.deleted_at is null
 join pcm.sso_versoes_os_origem_campo v on v.os_id=o.id and v.integracao=p.integracao and v.task_id=p.task_id
 join lateral (select x.* from pcm.sso_origem_campo_eventos x where x.integracao=p.integracao and x.task_id=p.task_id and x.estado='aceito' order by x.ordem_externa desc limit 1) ev on true
 where p.cliente_id=p_cliente_id and p.os_id=p_os_id and ev.contrato_id=p.contrato_id;
 if not found then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'envelopeId',r.envelope_id,'ordemExterna',r.ordem_externa::text,'revisao',r.revisao,
  'atual',jsonb_build_object('titulo',r.titulo,'descricao',r.descricao,'tecnicoAuvoId',r.tecnico_auvo_user_id::text,'dataAgendada',r.data_agendada,'checkIn',r.check_in_at,'checkOut',r.check_out_at),
  'declarado',jsonb_build_object('titulo',r.projecao->>'titulo','descricao',r.projecao->>'descricao','tecnicoAuvoId',r.projecao->>'tecnicoAuvoId','dataAgendada',r.projecao->>'dataAgendada','checkIn',r.projecao->>'checkIn','checkOut',r.projecao->>'checkOut'),
  'tecnicoAtualId',r.tecnico_funcionario_id,
  'tecnicoDeclaradoId',(select min(f.id::text)::uuid from pcm.funcionarios f where f.auvo_user_id::text=r.projecao->>'tecnicoAuvoId' and f.deleted_at is null having count(*)=1),
  'tecnicoAmbiguo',(select count(*)>1 from pcm.funcionarios f where f.auvo_user_id::text=r.projecao->>'tecnicoAuvoId' and f.deleted_at is null),
  'aplicavel',r.ordem_externa>r.ultima_ordem,'statusAlterado',false,'validacaoPcmComprovada',false);
end; $$;
revoke all on function pcm.sso_previa_conferencia_evento_campo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_previa_conferencia_evento_campo(uuid,uuid,uuid) to authenticated;

create function pcm.sso_confirmar_evento_campo_pcm(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_envelope_id uuid,p_ordem bigint,p_revisao bigint,p_tecnico_esperado uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare ant pcm.sso_conferencias_evento_campo%rowtype; o pcm.ordens_servico%rowtype; v pcm.sso_versoes_os_origem_campo%rowtype;
 p pcm.sso_origem_campo_processamentos%rowtype; e pcm.origem_campo_inbox%rowtype; payload jsonb; resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_os_id is null or p_envelope_id is null
  or p_ordem is null or p_ordem<1 or p_revisao is null or p_revisao<0 or length(btrim(coalesce(p_motivo,''))) not between 1 and 1000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_conferencia_evento_campo_gate where id and habilitado for share;
 if not found then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'envelopeId',p_envelope_id,'ordem',p_ordem,'revisao',p_revisao,'tecnicoEsperado',p_tecnico_esperado,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-conferencia-evento:'||p_request_id::text,0));
 select * into ant from pcm.sso_conferencias_evento_campo where request_id=p_request_id;
 if found then
  if ant.ator_id is distinct from p_ator_id or ant.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return ant.resultado;
 end if;
 select * into e from pcm.origem_campo_inbox where id=p_envelope_id and integracao='auvo' for update;
 if not found then raise exception 'origem_indisponivel' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-origem-campo-tarefa:'||e.task_id::text,0));
 select * into p from pcm.sso_origem_campo_processamentos where integracao='auvo' and task_id=e.task_id and cliente_id=p_cliente_id and os_id=p_os_id for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v from pcm.sso_versoes_os_origem_campo where os_id=p_os_id for update;
 if not found or v.revisao<>p_revisao or p_ordem<=v.ultima_ordem then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_origem_campo_eventos ev where ev.integracao='auvo' and ev.task_id=e.task_id and ev.ordem_externa=p_ordem and ev.envelope_id=p_envelope_id and ev.estado='aceito')
  or exists(select 1 from pcm.sso_origem_campo_eventos ev where ev.integracao='auvo' and ev.task_id=e.task_id and ev.estado='aceito' and ev.ordem_externa>p_ordem) then raise exception 'evento_obsoleto' using errcode='40001'; end if;
 if (select count(*) from pcm.funcionarios f join pcm.sso_origem_campo_eventos ev on ev.integracao='auvo' and ev.task_id=e.task_id and ev.ordem_externa=p_ordem where f.auvo_user_id::text=ev.projecao->>'tecnicoAuvoId' and f.deleted_at is null)>1
  or (select min(f.id::text)::uuid from pcm.funcionarios f join pcm.sso_origem_campo_eventos ev on ev.integracao='auvo' and ev.task_id=e.task_id and ev.ordem_externa=p_ordem where f.auvo_user_id::text=ev.projecao->>'tecnicoAuvoId' and f.deleted_at is null) is distinct from p_tecnico_esperado then
  raise exception 'tecnico_alterado' using errcode='40001'; end if;
 insert into pcm.sso_conferencia_evento_campo_tokens(txid,ator_id,envelope_id,ordem,revisao) values(pg_catalog.txid_current(),p_ator_id,p_envelope_id,p_ordem,p_revisao);
 resultado:=pcm.sso_aplicar_evento_origem_campo(p_envelope_id,p_ordem);
 delete from pcm.sso_conferencia_evento_campo_tokens where txid=pg_catalog.txid_current() and ator_id=p_ator_id and envelope_id=p_envelope_id and ordem=p_ordem;
 if resultado->>'estado' is distinct from 'aplicado' then raise exception 'aplicacao_nao_concluida' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 resultado:=resultado || jsonb_build_object('requestId',p_request_id,'atorId',p_ator_id);
 insert into pcm.sso_conferencias_evento_campo(request_id,ator_id,cliente_id,os_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,p_os_id,payload,resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'origem_campo.evento_conferido','ordens_servico',p_os_id,jsonb_build_object('requestId',p_request_id,'envelopeId',p_envelope_id,'ordem',p_ordem,'revisao',p_revisao,'tecnicoEsperado',p_tecnico_esperado,'motivo',btrim(p_motivo)));
 return resultado;
end; $$;
revoke all on function pcm.sso_confirmar_evento_campo_pcm(uuid,uuid,uuid,uuid,uuid,bigint,bigint,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_confirmar_evento_campo_pcm(uuid,uuid,uuid,uuid,uuid,bigint,bigint,uuid,text) to authenticated;
