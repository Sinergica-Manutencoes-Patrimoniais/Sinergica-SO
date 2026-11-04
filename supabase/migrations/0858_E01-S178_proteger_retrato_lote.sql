-- Invocação da versão anterior fica restrita ao wrapper que valida a seleção.
alter function pcm.sso_atualizar_selecao_levantamento(uuid,uuid,integer,jsonb) rename to sso_atualizar_selecao_levantamento_base_0858;
revoke all on function pcm.sso_atualizar_selecao_levantamento_base_0858(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
create function pcm.sso_atualizar_selecao_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_item jsonb;v_contexto jsonb;v_atributos jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_atualizacao_explicita_lote_gate where id),false) then raise exception 'atualizacao_lote_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if jsonb_array_length(p_itens) not between 1 and 50 then raise exception 'quantidade_invalida' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 -- Retry é verificado pelo comando original antes da comparação com o estado atual.
 if exists(select 1 from pcm.sso_levantamento_comandos where request_id=p_request_id) then return pcm.sso_atualizar_selecao_levantamento_base_0858(p_request_id,p_lote_id,p_expected_revision,p_itens);end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 for v_item in select value from jsonb_array_elements(p_itens) loop
  if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item->'campos') is distinct from 'object' or jsonb_typeof(v_item->'atributos') is distinct from 'object' or jsonb_typeof(v_item->'revisaoSelecao') is distinct from 'number' or (v_item->>'revisaoSelecao')::integer is distinct from p_expected_revision or coalesce(v_item->>'tipo','') not in ('sistema','componente') then raise exception 'selecao_invalida_ou_obsoleta' using errcode='40001';end if;
  select l.atributos into v_atributos from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.chave=v_item->>'chave';
  if not found or v_atributos is distinct from v_item->'atributos' then raise exception 'linha_divergente' using errcode='40001';end if;
  if v_item->>'tipo'='sistema' then v_contexto:=pcm.sso_consultar_campos_sistema_staging(p_lote_id,v_item->>'chave');else v_contexto:=pcm.sso_consultar_campos_componente_staging(p_lote_id,v_item->>'chave');end if;
  if v_contexto->'campos' is distinct from v_item->'campos' or (v_contexto->>'camposConferidos')::boolean is not true then raise exception 'campos_divergentes_ou_nao_conferidos' using errcode='40001';end if;
 end loop;
 return pcm.sso_atualizar_selecao_levantamento_base_0858(p_request_id,p_lote_id,p_expected_revision,p_itens);
end;$$;
revoke all on function pcm.sso_atualizar_selecao_levantamento(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
