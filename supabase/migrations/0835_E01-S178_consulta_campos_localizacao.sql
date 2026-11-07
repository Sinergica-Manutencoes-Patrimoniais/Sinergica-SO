create function pcm.sso_consultar_campos_localizacao_staging(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_campos jsonb;v_ciclo integer;v_conferida boolean;
begin
 if not coalesce((select habilitado from pcm.sso_campos_localizacao_staging_gate where id),false) then raise exception 'campos_desabilitados' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('area','local','sublocal') then raise exception 'linha_indisponivel' using errcode='23514';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 select campos into v_campos from pcm.sso_campos_localizacao_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao desc limit 1;
 v_conferida:=exists(select 1 from pcm.sso_conferencia_linhas where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo) or exists(select 1 from pcm.sso_conferencia_lotes c where c.lote_id=p_lote_id and c.revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0));
 return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'tipo',v_linha.tipo,'campos',coalesce(v_campos,'{}'::jsonb),'exigeReabertura',v_conferida,'aprovacaoBloqueada',v_campos is not null,'oficialAlterado',false);
end;$$;
revoke all on function pcm.sso_consultar_campos_localizacao_staging(uuid,text) from public,anon,authenticated,service_role;
