create function pcm.sso_listar_conferencias_campos_localizacao(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(revisao integer,revisao_campos integer,ciclo integer,campos jsonb,ator_id uuid,motivo text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_conferencia_campos_localizacao_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 return query select c.revisao,c.revisao_campos,c.ciclo,c.campos,c.ator_id,c.motivo,c.criado_em from pcm.sso_conferencias_campos_localizacao c where c.lote_id=p_lote_id and c.linha_chave=p_chave and (p_apos is null or c.revisao<p_apos) order by c.revisao desc limit p_limite;
end;$$;
revoke all on function pcm.sso_listar_conferencias_campos_localizacao(uuid,text,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_retrato_campos_localizacao_para_conferencia(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_campos pcm.sso_campos_localizacao_staging%rowtype;v_ciclo integer;v_linha_conferida boolean;
begin
 if not coalesce((select habilitado from pcm.sso_conferencia_campos_localizacao_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('area','local','sublocal') then raise exception 'linha_indisponivel' using errcode='23514';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 select * into v_campos from pcm.sso_campos_localizacao_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao desc limit 1;
 v_linha_conferida:=exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=p_lote_id and c.linha_chave=p_chave and c.ciclo=v_ciclo and c.atributos=v_linha.atributos);
 return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'ciclo',v_ciclo,'revisaoCampos',v_campos.revisao,'campos',v_campos.campos,'linhaConferida',v_linha_conferida,'aprovacaoBloqueada',true,'oficialAlterado',false);
end;$$;
revoke all on function pcm.sso_retrato_campos_localizacao_para_conferencia(uuid,text) from public,anon,authenticated,service_role;
