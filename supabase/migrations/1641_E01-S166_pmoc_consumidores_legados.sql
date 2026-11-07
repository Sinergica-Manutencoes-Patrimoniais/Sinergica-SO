-- ADR-1498: a materialização posterior não pode contornar a conferência PMOC.
create function pcm.sso_exigir_pmoc_ocorrencia_legada(p_cliente uuid,p_preparada uuid,p_tipo text)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_plano uuid;v_logica uuid;v_tipo text;v_alvo uuid;v_vencimento date;v_versao uuid;v_total integer;
begin
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;if not found then return;end if;
 if p_tipo='calendario' then
  select o.plano_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original into v_plano,v_logica,v_tipo,v_alvo,v_vencimento from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente where o.id=p_preparada;
 elsif p_tipo='visita' then
  select o.plano_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original into v_plano,v_logica,v_tipo,v_alvo,v_vencimento from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente where o.id=p_preparada;
 else raise exception 'tipo_invalido' using errcode='22023';end if;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 select count(*),min(id::text)::uuid into v_total,v_versao from pcm.plano_versoes where plano_id=v_plano and estado='aprovado' and vigencia_inicio<=v_vencimento and (vigencia_fim is null or vigencia_fim>=v_vencimento);
 if v_total<>1 then raise exception 'vigencia_ocorrencia_indeterminada' using errcode='23514';end if;
 perform pcm.sso_exigir_pmoc_conferido_visita(p_cliente,v_plano,v_versao,v_logica,v_tipo,v_alvo,v_vencimento);
end; $$;
revoke all on function pcm.sso_exigir_pmoc_ocorrencia_legada(uuid,uuid,text) from public,anon,authenticated,service_role;

do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_exigir_vigencia_ocorrencia_legada(uuid,uuid,text)'::regprocedure);
 v_antes text:=$antes$begin
 perform 1 from pcm.sso_continuidade_revisao_gate$antes$;
 v_depois text:=$depois$begin
 perform pcm.sso_exigir_pmoc_ocorrencia_legada(p_cliente,p_preparada,p_tipo);
 perform 1 from pcm.sso_continuidade_revisao_gate$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_vigencia_legada_incompativel' using errcode='55000';end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
