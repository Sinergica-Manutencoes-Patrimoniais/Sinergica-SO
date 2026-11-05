-- ADR-1483: versão vigente ou continuidade selada para novos vínculos legados.
create function pcm.sso_exigir_vigencia_ocorrencia_legada(p_cliente uuid,p_preparada uuid,p_tipo text)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_plano uuid;v_origem uuid;v_logica uuid;v_alvo_tipo text;v_alvo uuid;v_vencimento date;v_visita uuid;v_versao uuid;v_total integer;v_rotina uuid;v_snapshot jsonb;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return; end if;
 if p_tipo='calendario' then
  select o.plano_id,o.versao_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original
   into v_plano,v_origem,v_logica,v_alvo_tipo,v_alvo,v_vencimento from pcm.ocorrencias_rotina_preparadas o
   join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente where o.id=p_preparada;
 elsif p_tipo='visita' then
  select o.plano_id,o.versao_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original,o.visita_id
   into v_plano,v_origem,v_logica,v_alvo_tipo,v_alvo,v_vencimento,v_visita from pcm.ocorrencias_visita_preparadas o
   join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente where o.id=p_preparada;
 else raise exception 'tipo_invalido' using errcode='22023'; end if;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select count(*),min(id::text)::uuid into v_total,v_versao from pcm.plano_versoes
  where plano_id=v_plano and estado='aprovado' and vigencia_inicio<=v_vencimento and (vigencia_fim is null or vigencia_fim>=v_vencimento);
 if v_total<>1 then raise exception 'vigencia_ocorrencia_indeterminada' using errcode='23514'; end if;
 if v_versao=v_origem then return; end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=v_versao and plano_id=v_plano and estado='aprovado';
 if jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(r.item->>'id')::uuid into v_total,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') r(item)
  where r.item->>'modo'=p_tipo and r.item->>'rotina_logica_id'=v_logica::text and r.item->>'alvo_tipo'=v_alvo_tipo
   and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id',r.item->>'grupo_id')=v_alvo::text;
 if v_total<>1 then raise exception 'escopo_retirado_ou_indeterminado' using errcode='23514'; end if;
 if p_tipo='calendario' then
  if not pcm.sso_continuidade_ciclo_autorizada(p_cliente,v_plano,v_versao,v_rotina,p_preparada,v_vencimento) then raise exception 'continuidade_ciclo_nao_aprovada' using errcode='23514'; end if;
 else
  if not pcm.sso_continuidade_visita_autorizada(p_cliente,v_plano,v_versao,v_rotina,p_preparada,v_visita,v_vencimento) then raise exception 'continuidade_visita_nao_aprovada' using errcode='23514'; end if;
 end if;
end; $$;
revoke all on function pcm.sso_exigir_vigencia_ocorrencia_legada(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Inserir após o lock do Plano e antes de qualquer novo vínculo/materialização.
do $migracao$
declare v_item record;v_def text;v_antes text;v_depois text;
begin
 for v_item in select * from (values
  ('pcm.sso_materializar_ciclo_legado(uuid,uuid,uuid,uuid,uuid,uuid,text)','calendario_materializar'),
  ('pcm.sso_integrar_ciclo_legado_existente(uuid,uuid,uuid,uuid,uuid,uuid,text)','calendario_vincular'),
  ('pcm.sso_materializar_visita_legado(uuid,uuid,uuid,uuid,uuid,text)','visita_materializar'),
  ('pcm.sso_vincular_visita_legado_existente(uuid,uuid,uuid,uuid,uuid,text)','visita_vincular')
 ) t(assinatura,alvo)
 loop
  v_def:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);
  if v_item.alvo='calendario_materializar' then
   v_antes:=$antes$if not found or not pcm.sso_plano_permite_gerar_versao(v_plano.id,v_prep.versao_id) then raise exception 'plano_inativo' using errcode='23514';end if;$antes$;
  elsif v_item.alvo='calendario_vincular' then
   v_antes:=$antes$if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;$antes$;
  else
   v_antes:=$antes$if not found or v_plano.estado not in ('aprovado','ativo') then raise exception 'plano_inativo' using errcode='23514';end if;$antes$;
  end if;
  v_depois:=v_antes||E'\n perform pcm.sso_exigir_vigencia_ocorrencia_legada(p_cliente_id,'||case when v_item.alvo='visita_vincular' then 'p_visita_ocorrencia_id' else 'p_preparada_id' end||','''||case when v_item.alvo like 'calendario%' then 'calendario' else 'visita' end||''');';
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_legado_incompativel: %',v_item.assinatura using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;
