-- ADR-0464: cálculo informativo por índice histórico, sem leitura de data de execução.
create function pcm.sso_proximo_ciclo_ancorado(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_ciclo integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_num integer;v_base date;v_intervalo integer;v_unidade text;v_atual date;v_proximo date;v_feriado_atual boolean;v_feriado_proximo boolean;
begin
 if not coalesce((select habilitado from pcm.feriado_declarado_gate where id),false) then raise exception 'previsao_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_ciclo is null or p_ciclo<0 or p_ciclo>=2147483647 then raise exception 'ciclo_invalido' using errcode='22023'; end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or v_versao.vigencia_inicio is null or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_id::text;
 if v_num<>1 or v_rotina->>'modo' is distinct from 'calendario' then raise exception 'rotina_calendario_indisponivel' using errcode='23514'; end if;
 v_base:=(v_rotina->>'data_base')::date;v_intervalo:=(v_rotina->>'intervalo_n')::integer;v_unidade:=v_rotina->>'intervalo_unidade';
 v_atual:=pcm.sso_vencimento_ciclo_calendario(v_base,v_intervalo,v_unidade,p_ciclo);
 if v_atual<v_versao.vigencia_inicio or (v_versao.vigencia_fim is not null and v_atual>v_versao.vigencia_fim) then raise exception 'ciclo_fora_vigencia' using errcode='23514'; end if;
 begin v_proximo:=pcm.sso_vencimento_ciclo_calendario(v_base,v_intervalo,v_unidade,p_ciclo+1);exception when sqlstate '22023' then v_proximo:=null;end;
 if v_versao.vigencia_fim is not null and v_proximo>v_versao.vigencia_fim then v_proximo:=null;end if;
 select exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.contrato_id is null and f.ativo and f.data=v_atual),exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.contrato_id is null and f.ativo and f.data=v_proximo) into v_feriado_atual,v_feriado_proximo;
 return jsonb_build_object('ciclo',p_ciclo,'vencimentoOriginal',v_atual,'proximoCiclo',case when v_proximo is null then null else p_ciclo+1 end,'proximoVencimento',v_proximo,'feriadoAtual',case when v_feriado_atual then 'declarado_geral' else 'indeterminado' end,'feriadoProximo',case when v_proximo is null or not v_feriado_proximo then 'indeterminado' else 'declarado_geral' end,'fonteFeriadosIncompleta',true,'execucaoAlteraAncora',false,'ocorrenciaCriada',false);
end; $$;
revoke all on function pcm.sso_proximo_ciclo_ancorado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
