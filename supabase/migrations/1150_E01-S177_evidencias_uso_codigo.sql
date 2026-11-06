-- ADR-0997: diagnóstico limitado; ausência não prova falta de uso histórico.
create table pcm.sso_evidencias_uso_codigo_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_evidencias_uso_codigo_gate(id, habilitado) values (true, false);
alter table pcm.sso_evidencias_uso_codigo_gate enable row level security;
alter table pcm.sso_evidencias_uso_codigo_gate force row level security;
revoke all on pcm.sso_evidencias_uso_codigo_gate from public, anon, authenticated, service_role;

create function pcm.sso_consultar_evidencias_uso_codigo(p_ator_id uuid, p_cliente_id uuid, p_tipo text, p_ativo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_cliente uuid; v_auvo boolean; v_ciclo pcm.sso_codigo_ciclo%rowtype; v_os boolean; v_alias boolean;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode = '42501'; end if;
  if p_cliente_id is null or p_ativo_id is null or p_tipo is null or p_tipo not in ('sistema','componente') then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_evidencias_uso_codigo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'evidencias_codigo_desabilitadas' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
  if p_tipo = 'sistema' then
    select s.cliente_id, (s.auvo_id is not null or s.auvo_equipment_id is not null) into v_cliente, v_auvo from pcm.sistemas s where s.id = p_ativo_id and s.deleted_at is null;
  else
    select e.client_id, (e.auvo_id is not null or e.auvo_equipment_id is not null) into v_cliente, v_auvo from pcm.equipamentos e where e.id = p_ativo_id and e.deleted_at is null;
  end if;
  if v_cliente is distinct from p_cliente_id then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_ciclo from pcm.sso_codigo_ciclo c where c.tipo = p_tipo and c.ativo_id = p_ativo_id;
  if found and v_ciclo.cliente_id is distinct from p_cliente_id then raise exception 'ciclo_codigo_cliente_divergente' using errcode = '23514'; end if;
  select exists(select 1 from pcm.ordens_servico o where (p_tipo = 'sistema' and o.sistema_id = p_ativo_id) or (p_tipo = 'componente' and o.equipamento_id = p_ativo_id)) into v_os;
  select exists(select 1 from pcm.sso_codigo_aliases a where a.cliente_id = p_cliente_id and ((p_tipo = 'sistema' and a.sistema_id = p_ativo_id) or (p_tipo = 'componente' and a.componente_id = p_ativo_id))) into v_alias;
  return pg_catalog.jsonb_build_object('tipo',p_tipo,'ativoId',p_ativo_id,'clienteId',p_cliente_id,
    'vinculoAuvoAtual',v_auvo,'referenciaOsObservada',v_os,'aliasObservado',v_alias,
    'cicloRegistrado',v_ciclo.ativo_id is not null,'aprovadoEm',v_ciclo.aprovado_em,
    'sincronizadoEm',v_ciclo.sincronizado_em,'etiquetadoEm',v_ciclo.etiquetado_em,'referenciadoOsEm',v_ciclo.referenciado_os_em);
end;
$$;
revoke all on function pcm.sso_consultar_evidencias_uso_codigo(uuid,uuid,text,uuid) from public, anon, authenticated, service_role;
