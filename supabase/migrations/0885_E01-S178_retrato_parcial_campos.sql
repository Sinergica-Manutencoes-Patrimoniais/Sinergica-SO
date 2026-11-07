create function pcm.sso_retrato_aprovacao_parcial(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_campos jsonb;v_edicao record;v_codigo integer;v_ciclo integer;v_aprovada boolean;
begin
 if not coalesce((select habilitado from pcm.sso_aprovacao_parcial_gate where id),false) then raise exception 'aprovacao_parcial_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;if not found then raise exception 'linha_indisponivel' using errcode='23514';end if;
 select coalesce((select revisao from pcm.sso_codigo_staging where lote_id=p_lote_id and linha_chave=p_chave),0) into v_codigo;
 if v_linha.tipo in ('area','local','sublocal') then select campos into v_campos from pcm.sso_campos_localizacao_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao desc limit 1;
 elsif v_linha.tipo='sistema' then for v_edicao in select campos from pcm.sso_edicoes_sistema_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao_lote loop v_campos:=coalesce(v_campos,'{}'::jsonb)||v_edicao.campos;end loop;
 elsif v_linha.tipo in ('equipamento','componente') then for v_edicao in select campos from pcm.sso_edicoes_componente_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao_lote loop v_campos:=coalesce(v_campos,'{}'::jsonb)||v_edicao.campos;end loop;end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 select exists(select 1 from pcm.sso_aprovacoes_parciais_linhas a where a.lote_id=p_lote_id and a.linha_chave=p_chave and a.ciclo=v_ciclo and a.revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0) and a.atributos=v_linha.atributos and a.campos_estruturados is not distinct from v_campos and a.codigo_revision=v_codigo and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=p_lote_id and r.linha_chave=p_chave)) into v_aprovada;
 return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'atributos',v_linha.atributos,'camposEstruturados',v_campos,'codigoRevision',v_codigo,'aprovacaoParcialVigente',v_aprovada,'previsaoNaoAprova',true);
end;$$;
revoke all on function pcm.sso_retrato_aprovacao_parcial(uuid,text) from public,anon,authenticated,service_role;
