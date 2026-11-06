-- ADR-0351: diagnóstico de requisitos congelados, sem inferir fotos.
create function pcm.sso_checar_obrigatorias_retorno(p_cliente_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_item record;v_apos integer:=null;v_lidos integer;v_total integer:=0;v_obrigatorias integer:=0;v_sem_resposta integer:=0;v_nao_inspecionadas integer:=0;v_indeterminadas integer:=0;v_nao_ok integer:=0;v_decisoes_pcm integer:=0;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_validacao_resposta_gate where id),false) then raise exception 'cobertura_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 loop
  v_lidos:=0;
  for v_item in select * from pcm.sso_prever_cobertura_perguntas_contrato(p_cliente_id,p_retorno_id,v_apos,100) loop
   v_lidos:=v_lidos+1;v_total:=v_total+1;v_apos:=v_item.indice;
   if v_item.obrigatoriedade='indeterminada' then v_indeterminadas:=v_indeterminadas+1; end if;
   if v_item.obrigatoriedade='obrigatoria' then
    v_obrigatorias:=v_obrigatorias+1;
    if v_item.resposta_id is null then v_sem_resposta:=v_sem_resposta+1;
    elsif v_item.resultado='nao_inspecionado' then v_nao_inspecionadas:=v_nao_inspecionadas+1; end if;
   end if;
   if v_item.resultado='nao_ok' then v_nao_ok:=v_nao_ok+1; end if;
   if v_item.decisao_pcm='aceita_pcm' and v_item.revisao_uploads_decisao=v_item.revisao_uploads_atual then v_decisoes_pcm:=v_decisoes_pcm+1; end if;
  end loop;
  exit when v_lidos<100;
 end loop;
 return jsonb_build_object('perguntas',v_total,'obrigatorias',v_obrigatorias,'obrigatoriasSemResposta',v_sem_resposta,'obrigatoriasNaoInspecionadas',v_nao_inspecionadas,'obrigatoriedadeIndeterminada',v_indeterminadas,'respostasNaoOk',v_nao_ok,'decisoesPcmAceitasNaRevisao',v_decisoes_pcm,'exigenciaEvidencia','indeterminada','evidenciaAutenticada',false,'aprovacaoDisponivel',false);
end; $$;
revoke all on function pcm.sso_checar_obrigatorias_retorno(uuid,uuid) from public,anon,authenticated,service_role;
