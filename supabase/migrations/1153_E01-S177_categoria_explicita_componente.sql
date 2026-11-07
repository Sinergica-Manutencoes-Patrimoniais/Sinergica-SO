-- ADR-1000: mapeamento explícito sem alterar categoria textual ou fila Auvo.
create table pcm.sso_categoria_componente_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_categoria_componente_gate(id,habilitado) values(true,false);
create table pcm.sso_categoria_componente (
  componente_id uuid primary key references pcm.equipamentos(id), cliente_id uuid not null references pcm.clientes(id),
  categoria_id uuid not null references pcm.equipamento_categorias(id), texto_observado text,
  revisao integer not null check(revisao>0), atualizado_por uuid not null references auth.users(id), atualizado_em timestamptz not null default now()
);
create table pcm.sso_categoria_componente_comandos (
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_categoria_componente_gate enable row level security;
alter table pcm.sso_categoria_componente_gate force row level security;
alter table pcm.sso_categoria_componente enable row level security;
alter table pcm.sso_categoria_componente force row level security;
alter table pcm.sso_categoria_componente_comandos enable row level security;
alter table pcm.sso_categoria_componente_comandos force row level security;
revoke all on pcm.sso_categoria_componente_gate,pcm.sso_categoria_componente,pcm.sso_categoria_componente_comandos from public,anon,authenticated,service_role;

create function pcm.sso_mapear_categoria_componente(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_componente_id uuid,p_categoria_id uuid,p_texto_observado text,p_revisao integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_cliente uuid; v_texto text; v_anterior pcm.sso_categoria_componente%rowtype; v_comando pcm.sso_categoria_componente_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_request_id is null or p_componente_id is null or p_categoria_id is null or p_revisao is null or p_revisao<0 or p_motivo is null or pg_catalog.length(pg_catalog.btrim(p_motivo)) not between 1 and 2000 or pg_catalog.length(p_texto_observado)>1000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_categoria_componente_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'mapeamento_categoria_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'componente_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  v_payload:=pg_catalog.jsonb_build_object('clienteId',p_cliente_id,'componenteId',p_componente_id,'categoriaId',p_categoria_id,'textoObservado',p_texto_observado,'revision',p_revisao,'motivo',pg_catalog.btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('categoria-componente-request:' || p_request_id::text,0));
  select * into v_comando from pcm.sso_categoria_componente_comandos where request_id=p_request_id;
  if found then
    if v_comando.ator_id is distinct from p_ator_id or v_comando.cliente_id is distinct from p_cliente_id then raise exception 'componente_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  select e.client_id,e.categoria into v_cliente,v_texto from pcm.equipamentos e where e.id=p_componente_id and e.deleted_at is null for update;
  if v_cliente is distinct from p_cliente_id then raise exception 'componente_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if v_texto is distinct from p_texto_observado then raise exception 'categoria_textual_alterada' using errcode='40001'; end if;
  perform 1 from pcm.equipamento_categorias c where c.id=p_categoria_id and c.deleted_at is null for share;
  if not found then raise exception 'categoria_indisponivel' using errcode='23514'; end if;
  select * into v_anterior from pcm.sso_categoria_componente where componente_id=p_componente_id for update;
  if found and v_anterior.cliente_id is distinct from p_cliente_id then raise exception 'mapeamento_cliente_divergente' using errcode='23514'; end if;
  if coalesce(v_anterior.revisao,0)<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_categoria_componente(componente_id,cliente_id,categoria_id,texto_observado,revisao,atualizado_por)
    values(p_componente_id,p_cliente_id,p_categoria_id,p_texto_observado,p_revisao+1,p_ator_id)
    on conflict(componente_id) do update set categoria_id=excluded.categoria_id,texto_observado=excluded.texto_observado,revisao=excluded.revisao,atualizado_por=excluded.atualizado_por,atualizado_em=now();
  v_resultado:=pg_catalog.jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'componenteId',p_componente_id,'categoriaId',p_categoria_id,'revision',p_revisao+1);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'codigo.categoria_componente_mapeada','equipamento',p_componente_id,v_resultado || pg_catalog.jsonb_build_object('categoriaAnterior',v_anterior.categoria_id,'textoObservado',p_texto_observado,'motivo',pg_catalog.btrim(p_motivo)));
  insert into pcm.sso_categoria_componente_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_mapear_categoria_componente(uuid,uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated,service_role;
