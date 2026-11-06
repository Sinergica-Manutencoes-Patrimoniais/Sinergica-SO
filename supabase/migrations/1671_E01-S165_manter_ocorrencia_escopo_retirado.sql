-- ADR-1528: permitir continuidade apenas da ocorrência específica já mantida pelo PCM.
create function pcm.sso_manter_ocorrencia_escopo_retirado(p_cliente uuid,p_plano uuid,p_versao uuid,p_preparada uuid,p_tipo text,p_vencimento date)
returns boolean language sql stable security definer set search_path='' as $$
 select case p_tipo
 when 'calendario' then exists(
  select 1 from pcm.sso_continuidades_ciclo_aprovadas c
  join pcm.ocorrencias_rotina_preparadas o on o.id=c.preparada_id and o.plano_id=c.plano_id and o.vencimento_original=p_vencimento
  join pcm.plano_versoes v on v.id=c.versao_id and v.plano_id=c.plano_id and v.estado='aprovado' and v.vigencia_inicio=c.vigencia
  join pcm.sso_decisoes_impacto_ocorrencia d on d.request_id=c.decisao_request_id and d.cliente_id=c.cliente_id and d.plano_id=c.plano_id and d.rascunho_id=c.versao_id and d.preparada_id=c.preparada_id and d.decisao='manter_sem_alterar'
  where c.cliente_id=p_cliente and c.plano_id=p_plano and c.versao_id=p_versao and c.preparada_id=p_preparada and p_vencimento>=c.vigencia
 )
 when 'visita' then exists(
  select 1 from pcm.sso_continuidades_visita_aprovadas c
  join pcm.ocorrencias_visita_preparadas o on o.id=c.preparada_id and o.plano_id=c.plano_id and o.vencimento_original=p_vencimento
  join pcm.plano_versoes v on v.id=c.versao_id and v.plano_id=c.plano_id and v.estado='aprovado' and v.vigencia_inicio=c.vigencia
  join pcm.sso_decisoes_impacto_visita d on d.request_id=c.decisao_request_id and d.cliente_id=c.cliente_id and d.plano_id=c.plano_id and d.rascunho_id=c.versao_id and d.preparada_id=c.preparada_id and d.decisao='manter_sem_alterar'
  where c.cliente_id=p_cliente and c.plano_id=p_plano and c.versao_id=p_versao and c.preparada_id=p_preparada and p_vencimento>=c.vigencia
 )
 else false end;
$$;
revoke all on function pcm.sso_manter_ocorrencia_escopo_retirado(uuid,uuid,uuid,uuid,text,date) from public,anon,authenticated,service_role;

-- A ausência de correspondência só é tolerada para uma ocorrência já selada;
-- uma coincidência ambígua continua bloqueada e os geradores não usam esta exceção.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_exigir_vigencia_ocorrencia_legada(uuid,uuid,text)'::regprocedure);
 a text:=$antes$ if v_total<>1 then raise exception 'escopo_retirado_ou_indeterminado' using errcode='23514'; end if;$antes$;
 b text:=$depois$ if v_total=0 and pcm.sso_manter_ocorrencia_escopo_retirado(p_cliente,v_plano,v_versao,p_preparada,p_tipo,v_vencimento) then return; end if;
 if v_total<>1 then raise exception 'escopo_retirado_ou_indeterminado' using errcode='23514'; end if;$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_vigencia_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
