-- ADR-0344: retirada lógica privada, sem apagar Storage.
create table pcm.sso_retirada_anexo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_retirada_anexo_gate(id,habilitado) values(true,false);
create table pcm.sso_retiradas_anexo(id uuid primary key default gen_random_uuid(),tipo text not null check(tipo in ('foto','documento')),anexo_id uuid not null,cliente_id uuid not null references pcm.clientes(id),lote_id uuid not null references pcm.sso_levantamentos(id),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),unique(tipo,anexo_id));
alter table pcm.sso_retirada_anexo_gate enable row level security;alter table pcm.sso_retirada_anexo_gate force row level security;
alter table pcm.sso_retiradas_anexo enable row level security;alter table pcm.sso_retiradas_anexo force row level security;
revoke all on pcm.sso_retirada_anexo_gate,pcm.sso_retiradas_anexo from public,anon,authenticated,service_role;
create function pcm.sso_retirada_anexo_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_retirada_anexo_imutavel() from public,anon,authenticated,service_role;
create trigger sso_retirada_anexo_imutavel before update or delete on pcm.sso_retiradas_anexo for each row execute function pcm.sso_retirada_anexo_imutavel();
create function pcm.sso_retirar_anexo_levantamento(p_request_id uuid,p_tipo text,p_anexo_id uuid,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_cliente uuid;v_lote uuid;v_chave text;v_ant pcm.sso_retiradas_anexo%rowtype;v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_retirada_anexo_gate where id),false) then raise exception 'retirada_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_tipo is null or p_tipo not in ('foto','documento') or p_anexo_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('retirada-anexo:'||p_request_id::text,0));
  if p_tipo='foto' then select f.cliente_id,f.lote_id into v_cliente,v_lote from pcm.sso_fotos_levantamento f where f.id=p_anexo_id;
  else select d.cliente_id,d.lote_id into v_cliente,v_lote from pcm.sso_documentos_levantamento d where d.id=p_anexo_id; end if;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'anexo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.sso_levantamentos where id=v_lote and cliente_id=v_cliente for update;
  if not found then raise exception 'anexo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if p_tipo='foto' then select f.cliente_id,f.lote_id,f.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_fotos_levantamento f where f.id=p_anexo_id for update;
  else select d.cliente_id,d.lote_id,d.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_documentos_levantamento d where d.id=p_anexo_id for update; end if;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'anexo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_retiradas_anexo where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.tipo is distinct from p_tipo or v_ant.anexo_id is distinct from p_anexo_id or v_ant.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('retiradaId',v_ant.id,'tipo',p_tipo,'anexoId',p_anexo_id,'requestId',p_request_id);
  end if;
  if exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=v_lote and i.linha_chave=v_chave) or (p_tipo='foto' and (exists(select 1 from pcm.sso_foto_staging_grupo x where x.foto_id=p_anexo_id) or exists(select 1 from pcm.sso_foto_staging_ativo x where x.foto_id=p_anexo_id))) or (p_tipo='documento' and exists(select 1 from pcm.sso_documento_staging_ativo x where x.documento_id=p_anexo_id)) then raise exception 'anexo_ou_linha_ja_incorporado' using errcode='23514'; end if;
  insert into pcm.sso_retiradas_anexo(tipo,anexo_id,cliente_id,lote_id,motivo,ator_id,request_id) values(p_tipo,p_anexo_id,v_cliente,v_lote,btrim(p_motivo),v_ator,p_request_id) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.anexo_retirado','sso_levantamentos',v_lote,jsonb_build_object('clienteId',v_cliente,'anexoId',p_anexo_id,'tipo',p_tipo,'motivo',btrim(p_motivo),'requestId',p_request_id));
  return jsonb_build_object('retiradaId',v_id,'tipo',p_tipo,'anexoId',p_anexo_id,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_retirar_anexo_levantamento(uuid,text,uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_impedir_vinculo_anexo_retirado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_tipo text;
begin
  if tg_table_name='sso_documento_staging_ativo' then v_id:=new.documento_id;v_tipo:='documento';perform 1 from pcm.sso_documentos_levantamento where id=v_id for update;
  else v_id:=new.foto_id;v_tipo:='foto';perform 1 from pcm.sso_fotos_levantamento where id=v_id for update; end if;
  if exists(select 1 from pcm.sso_retiradas_anexo where tipo=v_tipo and anexo_id=v_id) then raise exception 'anexo_retirado' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_impedir_vinculo_anexo_retirado() from public,anon,authenticated,service_role;
create trigger sso_impedir_retirado before insert on pcm.sso_foto_staging_grupo for each row execute function pcm.sso_impedir_vinculo_anexo_retirado();
create trigger sso_impedir_retirado before insert on pcm.sso_foto_staging_ativo for each row execute function pcm.sso_impedir_vinculo_anexo_retirado();
create trigger sso_impedir_retirado before insert on pcm.sso_documento_staging_ativo for each row execute function pcm.sso_impedir_vinculo_anexo_retirado();
alter function pcm.sso_caminho_foto_levantamento(uuid) rename to sso_caminho_foto_levantamento_interno;
revoke all on function pcm.sso_caminho_foto_levantamento_interno(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_foto_levantamento(p_foto_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin v_nome:=pcm.sso_caminho_foto_levantamento_interno(p_foto_id);if exists(select 1 from pcm.sso_retiradas_anexo where tipo='foto' and anexo_id=p_foto_id) then raise exception 'anexo_indisponivel' using errcode='42501'; end if;return v_nome;end;
$$;
revoke all on function pcm.sso_caminho_foto_levantamento(uuid) from public,anon,authenticated,service_role;
alter function pcm.sso_caminho_documento_levantamento(uuid) rename to sso_caminho_documento_levantamento_interno;
revoke all on function pcm.sso_caminho_documento_levantamento_interno(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_documento_levantamento(p_documento_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin v_nome:=pcm.sso_caminho_documento_levantamento_interno(p_documento_id);if exists(select 1 from pcm.sso_retiradas_anexo where tipo='documento' and anexo_id=p_documento_id) then raise exception 'anexo_indisponivel' using errcode='42501'; end if;return v_nome;end;
$$;
revoke all on function pcm.sso_caminho_documento_levantamento(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_retirada_anexo(p_tipo text,p_anexo_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_ret pcm.sso_retiradas_anexo%rowtype;
begin
  if auth.uid() is null or p_tipo is null or p_tipo not in ('foto','documento') or p_anexo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if p_tipo='foto' then select f.cliente_id into v_cliente from pcm.sso_fotos_levantamento f where f.id=p_anexo_id;
  else select d.cliente_id into v_cliente from pcm.sso_documentos_levantamento d where d.id=p_anexo_id; end if;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ret from pcm.sso_retiradas_anexo where tipo=p_tipo and anexo_id=p_anexo_id;
  return jsonb_build_object('tipo',p_tipo,'anexoId',p_anexo_id,'retirado',v_ret.id is not null,'motivo',v_ret.motivo,'atorId',v_ret.ator_id,'criadoEm',v_ret.criado_em);
end;
$$;
revoke all on function pcm.sso_consultar_retirada_anexo(text,uuid) from public,anon,authenticated,service_role;
