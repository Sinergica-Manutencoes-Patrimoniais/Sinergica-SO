-- ADR-1254: declaração, sem impressão; gate fechado.
create table pcm.sso_etiqueta_grupo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_etiqueta_grupo_gate(id, habilitado) values(true, false);
alter table pcm.sso_etiqueta_grupo_gate enable row level security;
alter table pcm.sso_etiqueta_grupo_gate force row level security;
revoke all on pcm.sso_etiqueta_grupo_gate from public, anon, authenticated, service_role;

create function pcm.sso_declarar_etiqueta_grupo(p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_tipo text, p_ativo_id uuid, p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_payload jsonb; v_comando pcm.sso_codigo_comandos%rowtype; v_resultado jsonb; v_data timestamptz;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_request_id is null
    or p_tipo is distinct from 'grupo_quantitativo' or p_ativo_id is null or p_codigo is null or length(btrim(p_codigo)) not between 1 and 200 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_etiqueta_grupo_gate where id and habilitado for share;
  if not found then raise exception 'declaracao_etiqueta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is not true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao','declararEtiquetaGrupo','clienteId',p_cliente_id,'tipo',p_tipo,'ativoId',p_ativo_id,'codigo',p_codigo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('codigo-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.sso_codigo_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from p_ator_id or v_comando.cliente_id is distinct from p_cliente_id then raise exception 'sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then raise exception 'codigo_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_codigos_grupo_quantitativo c join pcm.grupos_quantitativos g on g.id=c.grupo_id and g.cliente_id=c.cliente_id
    where c.grupo_id=p_ativo_id and c.cliente_id=p_cliente_id and c.codigo=p_codigo and g.deleted_at is null;
  if not found then raise exception 'codigo_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
  v_data := now();
  v_resultado := jsonb_build_object('requestId',p_request_id,'tipo',p_tipo,'ativoId',p_ativo_id,'codigo',p_codigo,'etiquetadoEm',v_data,'revision',1);
  insert into pcm.sso_codigo_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'codigo.etiquetagem_declarada',p_tipo,p_ativo_id,v_resultado || jsonb_build_object('clienteId',p_cliente_id));
  return v_resultado;
end $$;
revoke all on function pcm.sso_declarar_etiqueta_grupo(uuid, uuid, uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_declarar_etiqueta_grupo(uuid, uuid, uuid, text, uuid, text) to authenticated;
