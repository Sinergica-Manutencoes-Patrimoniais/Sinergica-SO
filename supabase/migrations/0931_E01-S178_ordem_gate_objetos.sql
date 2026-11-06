create or replace function pcm.sso_exigir_quarentena_mediada(p_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 select cliente_id into v_cliente from pcm.sso_quarentena_csv_lotes where id=p_id;
 if not found or v_cliente is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_quarentena_mediada(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_exigir_evidencia_mediada(p_tipo text,p_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
declare v_lote uuid;
begin
 if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_id is null or p_tipo is null or p_tipo not in ('foto','documento') then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='foto' then select f.lote_id into v_lote from pcm.sso_fotos_levantamento f join pcm.sso_levantamentos l on l.id=f.lote_id and l.cliente_id=f.cliente_id where f.id=p_id;
 else select d.lote_id into v_lote from pcm.sso_documentos_levantamento d join pcm.sso_levantamentos l on l.id=d.lote_id and l.cliente_id=d.cliente_id where d.id=p_id; end if;
 if v_lote is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_exigir_mediacao_conferencia(v_lote);
end; $$;
revoke all on function pcm.sso_exigir_evidencia_mediada(text,uuid) from public,anon,authenticated,service_role;
