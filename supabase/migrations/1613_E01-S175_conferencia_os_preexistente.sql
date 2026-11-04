-- ADR-1470: OS preexistentes só recebem dados de campo mediante conferência PCM.
alter table pcm.sso_versoes_os_origem_campo add column aplicacao_automatica boolean not null default true;
alter table pcm.sso_versoes_os_origem_campo drop constraint sso_versoes_os_origem_campo_ultima_ordem_check;
alter table pcm.sso_versoes_os_origem_campo add constraint sso_versoes_os_origem_campo_ultima_ordem_check check (ultima_ordem>=0);

create or replace function pcm.sso_iniciar_versao_os_origem_campo() returns trigger
language plpgsql security definer set search_path='' as $$
declare nova boolean;
begin
  nova:=new.motivo in ('referencia_ausente','referencia_invalida_ou_outro_cliente','referencia_chamado');
  insert into pcm.sso_versoes_os_origem_campo(os_id,integracao,task_id,ultima_ordem,aplicacao_automatica)
    values(new.os_id,new.integracao,new.task_id,case when nova then (new.projecao->>'ordemExterna')::bigint else 0 end,nova);
  return new;
end; $$;

-- Token de conferência é emitido pelo comando autorizado da 1610 na mesma transação.
do $migration$
declare
 f regprocedure:='pcm.sso_aplicar_evento_origem_campo(uuid,bigint)'::regprocedure;
 d text:=pg_catalog.pg_get_functiondef(f);
 a text:=$old$if p_ordem=v.ultima_ordem then$old$;
 b text:=$new$if not v.aplicacao_automatica and not exists(select 1 from pcm.sso_conferencia_evento_campo_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=auth.uid() and t.envelope_id=p_envelope_id and t.ordem=p_ordem and t.revisao=v.revisao) then
    return jsonb_build_object('estado','pendente','motivo','os_preexistente_exige_conferencia','envelopeId',e.id,'ordemExterna',p_ordem::text);
  end if;
  if p_ordem=v.ultima_ordem then$new$;
 f_inicial regprocedure:='pcm.sso_processar_tarefa_campo_atomica(uuid,uuid,jsonb)'::regprocedure;
 d_inicial text:=pg_catalog.pg_get_functiondef(f_inicial);
 antigo text:=$old$'reutilizado',false,'eventoAplicado',true)$old$;
 novo text:=$new$'reutilizado',false,'eventoAplicado',motivo not in ('os_existente','os_externa_identificada'))$new$;
begin
 if length(d)-length(replace(d,a,''))<>length(a) or length(d_inicial)-length(replace(d_inicial,antigo,''))<>length(antigo) then
   raise exception 'definicao_processamento_incompativel' using errcode='55000';
 end if;
 execute replace(d,a,b);
 execute replace(d_inicial,antigo,novo);
end; $migration$;

-- A prévia informa se eventos futuros podem seguir o caminho automático.
do $migration$
declare
 f regprocedure:='pcm.sso_previa_conferencia_evento_campo(uuid,uuid,uuid)'::regprocedure;
 d text:=pg_catalog.pg_get_functiondef(f);
 a text:=$old$v.revisao, v.ultima_ordem, ev.envelope_id$old$;
 b text:=$new$v.revisao, v.ultima_ordem, v.aplicacao_automatica, ev.envelope_id$new$;
 c text:=$old$'aplicavel',r.ordem_externa>r.ultima_ordem,'statusAlterado'$old$;
 e text:=$new$'aplicavel',r.ordem_externa>r.ultima_ordem,'aplicacaoAutomatica',r.aplicacao_automatica,'statusAlterado'$new$;
begin
 if length(d)-length(replace(d,a,''))<>length(a) or length(d)-length(replace(d,c,''))<>length(c) then raise exception 'definicao_previa_incompativel' using errcode='55000'; end if;
 execute replace(replace(d,a,b),c,e);
end; $migration$;
