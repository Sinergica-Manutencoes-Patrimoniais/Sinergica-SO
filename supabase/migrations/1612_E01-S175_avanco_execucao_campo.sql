-- ADR-1469: avanço apenas para execução, sem encerrar ou validar.
do $migration$
declare
 f regprocedure:='pcm.sso_aplicar_evento_origem_campo(uuid,bigint)'::regprocedure;
 d text:=pg_catalog.pg_get_functiondef(f);
 a text:=$old$update pcm.ordens_servico set titulo=ev.projecao->>'titulo',$old$;
 b text:=$new$update pcm.ordens_servico set status=case when auth.role()='service_role' and status='solicitacao' and ev.projecao->>'statusCampo' in ('em_andamento','concluida') then 'em_execucao' else status end, titulo=ev.projecao->>'titulo',$new$;
 c text:=$old$'ordemExterna',p_ordem::text,'reutilizado',false,'validacaoPcmComprovada',false,'chamadoAlterado',false);$old$;
 e text:=$new$'ordemExterna',p_ordem::text,'reutilizado',false,'validacaoPcmComprovada',false,'chamadoAlterado',false,
    'statusAlterado',auth.role()='service_role' and o.status='solicitacao' and ev.projecao->>'statusCampo' in ('em_andamento','concluida'),
    'statusOperacional',case when auth.role()='service_role' and o.status='solicitacao' and ev.projecao->>'statusCampo' in ('em_andamento','concluida') then 'em_execucao' else o.status end);$new$;
begin
 if length(d)-length(replace(d,a,''))<>length(a) or length(d)-length(replace(d,c,''))<>length(c) then raise exception 'definicao_aplicacao_incompativel' using errcode='55000'; end if;
 execute replace(replace(d,a,b),c,e);
end; $migration$;
