-- ADR-0721: estado de elegibilidade, sem alterar o vínculo nem seu replay.
create or replace function pcm.sso_consultar_destino_foto_ativo_mediado(p_foto_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid; v_resultado jsonb; v_tipo text; v_entidade uuid; v_ativo boolean;
begin
  if auth.uid() is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select cliente_id into v_cliente from pcm.sso_fotos_levantamento where id=p_foto_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then
    raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501';
  end if;
  v_resultado:=pcm.sso_consultar_destino_foto_ativo(p_foto_id);
  v_tipo:=v_resultado->>'tipo'; v_entidade:=(v_resultado->>'entidadeId')::uuid;
  if v_tipo='sistema' then
    select exists(select 1 from pcm.sistemas s where s.id=v_entidade and s.cliente_id=v_cliente and s.ativo and s.deleted_at is null) into v_ativo;
  elsif v_tipo='componente' then
    select exists(select 1 from pcm.equipamentos e where e.id=v_entidade and e.client_id=v_cliente and e.tipo='componente' and e.ativo and e.deleted_at is null) into v_ativo;
  else v_ativo:=null;
  end if;
  return v_resultado || jsonb_build_object('fotoInadequada',pcm.sso_foto_inadequada(p_foto_id),'destinoAtivo',v_ativo);
end; $$;
revoke all on function pcm.sso_consultar_destino_foto_ativo_mediado(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_destino_foto_ativo_mediado(uuid) to authenticated;
