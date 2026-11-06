-- ADR-0996: declaração auditada, não comprovação física de etiqueta.
create table pcm.sso_declarar_etiqueta_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_declarar_etiqueta_gate(id, habilitado) values (true, false);
alter table pcm.sso_declarar_etiqueta_gate enable row level security;
alter table pcm.sso_declarar_etiqueta_gate force row level security;
revoke all on pcm.sso_declarar_etiqueta_gate from public, anon, authenticated, service_role;

create function pcm.sso_declarar_etiquetagem(
  p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_tipo text, p_ativo_id uuid, p_codigo text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cliente uuid; v_codigo text; v_ciclo pcm.sso_codigo_ciclo%rowtype;
  v_comando pcm.sso_codigo_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode = '42501'; end if;
  if p_cliente_id is null or p_request_id is null or p_ativo_id is null or p_tipo is null or p_tipo not in ('sistema','componente')
    or p_codigo is null or pg_catalog.length(pg_catalog.btrim(p_codigo)) not between 1 and 200 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_declarar_etiqueta_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'declaracao_etiqueta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := pg_catalog.jsonb_build_object('operacao','declararEtiquetagem','clienteId',p_cliente_id,'tipo',p_tipo,'ativoId',p_ativo_id,'codigo',p_codigo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('codigo-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.sso_codigo_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from p_ator_id or v_comando.cliente_id is distinct from p_cliente_id then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode = '40001'; end if;
  if p_tipo = 'sistema' then
    select s.cliente_id, s.codigo into v_cliente, v_codigo from pcm.sistemas s where s.id = p_ativo_id and s.deleted_at is null for update;
  else
    select e.client_id, e.identificador into v_cliente, v_codigo from pcm.equipamentos e where e.id = p_ativo_id and e.deleted_at is null for update;
  end if;
  if v_cliente is distinct from p_cliente_id then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
  if v_codigo is distinct from p_codigo then raise exception 'codigo_anterior_divergente' using errcode = '40001'; end if;
  insert into pcm.sso_codigo_ciclo(tipo, ativo_id, cliente_id) values(p_tipo, p_ativo_id, p_cliente_id) on conflict(tipo, ativo_id) do nothing;
  select * into v_ciclo from pcm.sso_codigo_ciclo where tipo = p_tipo and ativo_id = p_ativo_id for update;
  if v_ciclo.cliente_id is distinct from p_cliente_id then raise exception 'ciclo_codigo_cliente_divergente' using errcode = '23514'; end if;
  if v_ciclo.etiquetado_em is null then
    update pcm.sso_codigo_ciclo set etiquetado_em = pg_catalog.now(), revisao = revisao + 1
      where tipo = p_tipo and ativo_id = p_ativo_id returning * into v_ciclo;
  end if;
  v_resultado := pg_catalog.jsonb_build_object('requestId',p_request_id,'tipo',p_tipo,'ativoId',p_ativo_id,'codigo',p_codigo,'etiquetadoEm',v_ciclo.etiquetado_em,'revision',v_ciclo.revisao);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'codigo.etiquetagem_declarada',p_tipo,p_ativo_id,v_resultado || pg_catalog.jsonb_build_object('clienteId',p_cliente_id));
  insert into pcm.sso_codigo_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_declarar_etiquetagem(uuid,uuid,uuid,text,uuid,text) from public, anon, authenticated, service_role;
