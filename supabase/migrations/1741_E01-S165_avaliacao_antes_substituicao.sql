-- ADR-1599: revalidar avaliação tardia na origem antes de substituir.
do $patch$
declare d text; a text; b text;
begin
 d:=pg_catalog.pg_get_functiondef('pcm.sso_vincular_nova_data_calendario()'::regprocedure);
 a:=$a$  perform pcm.sso_travar_fontes_impacto_grupo();$a$;
 b:=$b$  lock table pcm.avaliacoes_preventivas in share mode nowait;
  perform pcm.sso_travar_fontes_impacto_grupo();$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'substituicao_calendario_incompativel' using errcode='55000';end if;
 d:=replace(d,a,b);
 a:=$a$or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=leg.id)))$a$;
 b:=$b$or exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=leg.id) or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=leg.id)))$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'fonte_calendario_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
 d:=pg_catalog.pg_get_functiondef('pcm.sso_vincular_nova_visita()'::regprocedure);
 a:=$a$  v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(v_item.cliente_id,v_item.plano_id,v_item.preparada_id,'visita');$a$;
 b:=$b$  lock table pcm.avaliacoes_preventivas in share mode nowait;
  if exists(select 1 from pcm.sso_ciclo_visita_versoes anterior
    join pcm.sso_ciclo_visita_versoes origem on origem.ciclo_id=anterior.ciclo_id
    join pcm.sso_vinculos_visita_legado ponte on ponte.ocorrencia_visita_id=origem.preparada_id
    join pcm.avaliacoes_preventivas av on av.ocorrencia_id=ponte.ocorrencia_legada_id
    where anterior.preparada_id=v_item.preparada_id) then
   raise exception 'origem_antiga_exige_reconciliacao' using errcode='23514';
  end if;
  v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(v_item.cliente_id,v_item.plano_id,v_item.preparada_id,'visita');$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'substituicao_visita_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
