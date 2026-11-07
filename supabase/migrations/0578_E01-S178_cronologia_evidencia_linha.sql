-- ADR-0352: somente cronologia registrada no SSO, sem inferência de pertinência.
create table pcm.sso_cronologia_evidencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_cronologia_evidencia_gate(id,habilitado) values(true,false);
alter table pcm.sso_cronologia_evidencia_gate enable row level security;alter table pcm.sso_cronologia_evidencia_gate force row level security;
revoke all on pcm.sso_cronologia_evidencia_gate from public,anon,authenticated,service_role;
create function pcm.sso_cronologia_evidencia_linha(p_tipo text,p_anexo_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_lote uuid;v_chave text;v_criado timestamptz;v_depois bigint;v_empate bigint;
begin
  if not coalesce((select habilitado from pcm.sso_cronologia_evidencia_gate where id),false) then raise exception 'cronologia_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_tipo is null or p_tipo not in ('foto','documento') or p_anexo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if p_tipo='foto' then select f.cliente_id,f.lote_id,f.linha_chave,f.criado_em into v_cliente,v_lote,v_chave,v_criado from pcm.sso_fotos_levantamento f where f.id=p_anexo_id;
  else select d.cliente_id,d.lote_id,d.linha_chave,d.criado_em into v_cliente,v_lote,v_chave,v_criado from pcm.sso_documentos_levantamento d where d.id=p_anexo_id; end if;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*) filter(where e.criado_em>v_criado),count(*) filter(where e.criado_em=v_criado) into v_depois,v_empate from pcm.sso_edicoes_linha_staging e where e.lote_id=v_lote and e.linha_chave=v_chave;
  return jsonb_build_object('tipo',p_tipo,'anexoId',p_anexo_id,'edicoesPosteriores',v_depois,'empates',v_empate);
end;
$$;
revoke all on function pcm.sso_cronologia_evidencia_linha(text,uuid) from public,anon,authenticated,service_role;
