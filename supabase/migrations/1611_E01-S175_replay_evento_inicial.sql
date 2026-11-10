-- ADR-1467: reentrega da fotografia inicial não cria OS nem sugere alteração atual.
do $migration$
declare
 f regprocedure:='pcm.sso_aplicar_evento_origem_campo(uuid,bigint)'::regprocedure;
 d text:=pg_catalog.pg_get_functiondef(f);
 anterior text:=$old$if p_ordem<=v.ultima_ordem then return jsonb_build_object('estado','pendente','motivo','evento_ja_contemplado','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;$old$;
 novo text:=$new$if p_ordem=v.ultima_ordem then return jsonb_build_object('estado','ja_contemplado','envelopeId',e.id,'osId',o.id,'clienteId',p.cliente_id,'ordemExterna',p_ordem::text,'validacaoPcmComprovada',false,'chamadoAlterado',false); end if;
  if p_ordem<v.ultima_ordem then return jsonb_build_object('estado','pendente','motivo','evento_desatualizado','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;$new$;
begin
 if length(d)-length(replace(d,anterior,''))<>length(anterior) then raise exception 'definicao_aplicacao_incompativel' using errcode='55000'; end if;
 execute replace(d,anterior,novo);
end; $migration$;
