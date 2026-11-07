-- ADR-0426: compara conteúdo integral sem projetar ou descartar campos desconhecidos.
create function pcm.sso_comparar_questionario_revisao(p_cliente_id uuid,p_plano_id uuid,p_revisao integer,p_rotina_logica_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_snapshot jsonb; v_antiga jsonb; v_nova jsonb; v_questionario jsonb; v_num integer; v_questionario_id uuid; v_anterior_id text; v_status text;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'impacto_revisao_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_rotina_logica_id is null then raise exception 'rotina_invalida' using errcode='22023'; end if;
 v_base:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_revisao,1,null);
 select snapshot into v_snapshot from pcm.plano_versoes where id=(v_base->>'versaoAnteriorId')::uuid and plano_id=p_plano_id and estado='aprovado';
 if jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(item::text)::jsonb into v_num,v_antiga from jsonb_array_elements(v_snapshot->'rotinas') x(item) where item->>'rotina_logica_id'=p_rotina_logica_id::text;
 if v_num>1 then raise exception 'rotina_historica_ambigua' using errcode='23514'; end if;
 select count(*),min(to_jsonb(r)::text)::jsonb into v_num,v_nova from pcm.rotinas_manutencao r where r.plano_id=p_plano_id and r.versao_id=(v_base->>'versaoRascunhoId')::uuid and r.rotina_logica_id=p_rotina_logica_id;
 if v_num>1 then raise exception 'rotina_rascunho_ambigua' using errcode='23514'; end if;
 if v_antiga is null or v_nova is null then v_status:='nao_comparavel';
 else
   v_anterior_id:=v_antiga->>'questionario_id'; v_questionario_id:=(v_nova->>'questionario_id')::uuid;
   if v_anterior_id is null and v_questionario_id is null then v_status:='sem_questionario';
   elsif v_anterior_id is distinct from v_questionario_id::text then v_status:='referencia_alterada';
   elsif jsonb_typeof(v_antiga->'questionario') is distinct from 'object' or jsonb_typeof(v_antiga->'questionario'->'perguntas') is distinct from 'array' then v_status:='historico_indeterminado';
   else
     select to_jsonb(q) into v_questionario from pcm.questionarios q where q.id=v_questionario_id and q.ativo;
     if v_questionario is null or jsonb_typeof(v_questionario->'perguntas') is distinct from 'array' then v_status:='fonte_atual_indisponivel';
     elsif (v_antiga->'questionario')=v_questionario then v_status:='conteudo_integral_igual';
     else v_status:='conteudo_integral_diferente'; end if;
   end if;
 end if;
 return jsonb_build_object('revisao',p_revisao,'rotinaLogicaId',p_rotina_logica_id,'estadoComparacao',v_status,'comparacaoIntegralIncluiMetadados',true,'conteudoAntigoPreservado',true,'fonteRascunhoMutavel',true,'impactoOperacionalCalculado',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_comparar_questionario_revisao(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
