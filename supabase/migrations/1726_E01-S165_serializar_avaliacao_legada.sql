-- ADR-1582: protege também a ausência de escolha contra uma decisão concorrente.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_legada_resolvida_por_escolha_rascunho(uuid,uuid,uuid,integer,uuid)'::regprocedure);
 a text:=$antes$ if p_cliente is null or p_plano is null or p_rascunho is null or p_revisao is null or p_legada is null then return false;end if;
 select l.*$antes$;
 b text:=$depois$ if p_cliente is null or p_plano is null or p_rascunho is null or p_revisao is null or p_legada is null then return false;end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente and revisao=p_revisao for share nowait;
 if not found then return false;end if;
 select l.*$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'avaliacao_legada_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
