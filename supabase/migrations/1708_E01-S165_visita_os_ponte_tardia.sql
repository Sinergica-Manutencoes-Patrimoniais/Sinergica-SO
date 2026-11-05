-- ADR-1564: fonte histórica por ponte deve ser reconferida antes da geração.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_vincular_nova_visita()'::regprocedure);
 a text:=$a$  v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(v_item.cliente_id,v_item.plano_id,v_item.preparada_id,'visita');$a$;
 b text:=$b$  lock table pcm.sso_vinculos_visita_legado,pcm.ordens_servico,pcm.sso_ciclo_visita_versoes in share mode nowait;
  if exists(select 1 from pcm.sso_ciclo_visita_versoes anterior
    join pcm.sso_ciclo_visita_versoes origem on origem.ciclo_id=anterior.ciclo_id
    join pcm.sso_vinculos_visita_legado ponte on ponte.ocorrencia_visita_id=origem.preparada_id
    join pcm.ordens_servico os on os.ocorrencia_preventiva_id=ponte.ocorrencia_legada_id
    where anterior.preparada_id=v_item.preparada_id) then
   raise exception 'origem_antiga_exige_reconciliacao' using errcode='23514';
  end if;
  v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(v_item.cliente_id,v_item.plano_id,v_item.preparada_id,'visita');$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'vinculo_visita_os_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
