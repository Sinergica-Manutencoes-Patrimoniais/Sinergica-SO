-- ADR-1595: incluir avaliações na fotografia já confirmada pelo PCM.
do $patch$
declare
 d text; a text; b text; alvo regprocedure;
begin
 for alvo in select unnest(array[
 'pcm.sso_prever_reserva_calendario_rascunho(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,integer)'::regprocedure,
 'pcm.sso_prever_reserva_visita_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer)'::regprocedure]) loop
  d:=pg_catalog.pg_get_functiondef(alvo);
  a:='v_foto:=pcm.sso_foto_reserva_ciclo';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'previa_foto_incompativel' using errcode='55000';end if;
  d:=replace(d,a,'lock table pcm.avaliacoes_preventivas in share mode nowait;'||chr(10)||' '||a);
  if alvo='pcm.sso_prever_reserva_calendario_rascunho(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,integer)'::regprocedure then
   a:='or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=op.id)))';
   b:='or exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=op.id) or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=op.id)))';
  else
   a:='l.resultado_estado<>''pendente'')),''osLegada''';
   b:='l.resultado_estado<>''pendente'' or exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=l.id))),''osLegada''';
  end if;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'previa_efeito_incompativel' using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
