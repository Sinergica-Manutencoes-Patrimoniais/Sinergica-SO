-- ADR-1594: evidência recebida invalida resolução da fonte no impacto.
do $patch$
declare
 d text := pg_catalog.pg_get_functiondef('pcm.sso_legada_resolvida_por_escolha_rascunho(uuid,uuid,uuid,integer,uuid)'::regprocedure);
 a text := ' select l.* into v_leg from pcm.ocorrencias_preventivas l join pcm.planos_preventivos p on p.id=l.plano_id and p.cliente_id=p_cliente';
 b text := '  or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_leg.id) then return false;end if;';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,b,'')))/length(b)<>1 then
  raise exception 'avaliacao_legada_impacto_definicao_incompativel' using errcode='55000';
 end if;
 d:=replace(d,a,' lock table pcm.avaliacoes_preventivas in share mode nowait;'||chr(10)||a);
 d:=replace(d,b,'  or exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=v_leg.id)'||chr(10)||b);
 execute d;
end; $patch$;
