-- ADR-1560: nativo canônico não precisa de ponte legada artificial.
-- As demais fontes continuam verificadas por 1686; 1045 não é alterada.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_avaliar_decisoes_impacto(uuid,uuid,integer)'::regprocedure);
 a text:=$antes$count(*) filter(where ocorrencia_legada_id is null or os_count>100)$antes$;
 b text:=$depois$count(*) filter(where os_count>100 or (ocorrencia_legada_id is null and not exists(
  select 1 from pcm.sso_ciclo_calendario_versoes cv
  join pcm.sso_ciclos_calendario_canonicos c on c.id=cv.ciclo_id
  join pcm.sso_series_ciclo_calendario serie on serie.id=c.serie_id
  where cv.preparada_id=itens.id and cv.versao_id::text=itens.preparada_atual->>'versao_id'
   and c.indice::text=itens.preparada_atual->>'ciclo' and c.vencimento_original::text=itens.preparada_atual->>'vencimento_original'
   and serie.plano_id=p_plano_id and serie.rotina_logica_id::text=itens.preparada_atual->>'rotina_logica_id'
   and serie.alvo_tipo=itens.preparada_atual->>'alvo_tipo' and serie.alvo_id::text=itens.preparada_atual->>'alvo_id'
  )))$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_avaliacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
