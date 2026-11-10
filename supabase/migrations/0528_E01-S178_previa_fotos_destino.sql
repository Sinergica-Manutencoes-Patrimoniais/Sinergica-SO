-- ADR-0302: prévia sem publicação ou movimentação de arquivos.
create table pcm.sso_previa_fotos_destino_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_previa_fotos_destino_gate(id,habilitado) values(true,false);
alter table pcm.sso_previa_fotos_destino_gate enable row level security;
alter table pcm.sso_previa_fotos_destino_gate force row level security;
revoke all on pcm.sso_previa_fotos_destino_gate from public,anon,authenticated,service_role;
create function pcm.sso_previa_fotos_destino(p_lote_id uuid,p_chave text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_tipo text;v_incorporada boolean;v_total bigint;
begin
  if not coalesce((select habilitado from pcm.sso_previa_fotos_destino_gate where id),false) then raise exception 'previa_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select l.tipo into v_tipo from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.chave=p_chave;
  if not found then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  select exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=p_chave) into v_incorporada;
  select count(*) into v_total from pcm.sso_fotos_levantamento f where f.cliente_id=v_cliente and f.lote_id=p_lote_id and f.linha_chave=p_chave;
  return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'tipo',v_tipo,'linhaIncorporada',v_incorporada,'fotosStaging',v_total);
end;
$$;
revoke all on function pcm.sso_previa_fotos_destino(uuid,text) from public,anon,authenticated,service_role;
