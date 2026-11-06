-- ADR-0171: wrappers privados; sem concessão operacional.
create function pcm.sso_codigo_staging_para_aprovacao(p_lote_id uuid,p_chave text)
returns table(codigo text,revisao integer) language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select s.codigo,s.revisao from pcm.sso_codigo_staging s where s.lote_id=p_lote_id and s.linha_chave=p_chave;
end;
$$;
revoke all on function pcm.sso_codigo_staging_para_aprovacao(uuid,text) from public,anon,authenticated,service_role;

create table pcm.sso_incorporacao_codigo_requests (
  request_id uuid primary key,
  ator_id uuid not null references config.usuarios(user_id),
  payload jsonb not null,
  resultado jsonb not null
);
alter table pcm.sso_incorporacao_codigo_requests enable row level security;
alter table pcm.sso_incorporacao_codigo_requests force row level security;
revoke all on pcm.sso_incorporacao_codigo_requests from public,anon,authenticated,service_role;

create function pcm.sso_incorporar_ativo_codigo_staging(
  p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_local_id uuid,p_categoria_id uuid,
  p_sistema_id uuid,p_parent_id uuid,p_codigo text,p_quantidade bigint,p_codigo_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lote pcm.sso_levantamentos%rowtype; v_codigo pcm.sso_codigo_staging%rowtype;
  v_request pcm.sso_incorporacao_codigo_requests%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_levantamento_ativos_gate where chave),false) then raise exception 'incorporacao_ativos_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_lote_id is null or p_chave is null or p_codigo_revision is null or p_codigo_revision<0 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'localId',p_local_id,'categoriaId',p_categoria_id,'sistemaId',p_sistema_id,'parentId',p_parent_id,'codigo',p_codigo,'quantidade',p_quantidade,'codigoRevision',p_codigo_revision);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_request from pcm.sso_incorporacao_codigo_requests where request_id=p_request_id;
  if found then
    if v_request.ator_id is distinct from auth.uid() or v_request.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_request.resultado;
  end if;
  select * into v_codigo from pcm.sso_codigo_staging where lote_id=p_lote_id and linha_chave=p_chave for update;
  if coalesce(v_codigo.revisao,0)<>p_codigo_revision then raise exception 'codigo_staging_revisao_obsoleta' using errcode='40001'; end if;
  if v_codigo.codigo is not null and p_codigo is distinct from v_codigo.codigo then raise exception 'codigo_staging_divergente' using errcode='40001'; end if;
  v_resultado:=pcm.sso_incorporar_ativo_levantamento(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,coalesce(v_codigo.codigo,p_codigo),p_quantidade);
  insert into pcm.sso_incorporacao_codigo_requests(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_incorporar_ativo_codigo_staging(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint,integer) from public,anon,authenticated,service_role;
