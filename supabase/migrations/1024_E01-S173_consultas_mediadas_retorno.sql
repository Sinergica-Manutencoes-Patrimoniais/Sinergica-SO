-- ADR-0836: leituras fechadas pelo gate da mediação 1023.
-- Qualifica id, ambíguo com coluna de saída; preserva a ACL do núcleo privado.
create or replace function pcm.sso_listar_condicoes_estruturais_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,revisao_evidencias integer,revisao_decisao integer,diagnostico jsonb,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.validacao_os_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_condicao_retorno_gate g where g.id),false) then raise exception 'condicao_retorno_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado r where r.id=p_retorno_id and r.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select c.id,c.revisao_evidencias,c.revisao_decisao,c.diagnostico,c.criado_em from pcm.sso_condicoes_estruturais_retorno c where c.retorno_id=p_retorno_id and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_condicoes_estruturais_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_condicoes_retorno_mediado(
  p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer
) returns table(id uuid,revisao_evidencias integer,revisao_decisao integer,diagnostico jsonb,criado_em timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  select habilitado into v_habilitado from pcm.sso_mediacao_pendencias_retorno_gate where pcm.sso_mediacao_pendencias_retorno_gate.id for share;
  if v_habilitado is distinct from true then raise exception 'mediacao_pendencias_bloqueada' using errcode='55000'; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.id,c.revisao_evidencias,c.revisao_decisao,c.diagnostico,c.criado_em
    from pcm.sso_listar_condicoes_estruturais_retorno(p_cliente_id,p_retorno_id,p_apos,p_limite) c;
end; $$;
revoke all on function pcm.sso_listar_condicoes_retorno_mediado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_condicoes_retorno_mediado(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_decisoes_retorno_mediado(
  p_cliente_id uuid,p_retorno_id uuid,p_antes integer,p_limite integer
) returns table(revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  select habilitado into v_habilitado from pcm.sso_mediacao_pendencias_retorno_gate where pcm.sso_mediacao_pendencias_retorno_gate.id for share;
  if v_habilitado is distinct from true then raise exception 'mediacao_pendencias_bloqueada' using errcode='55000'; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select d.revisao,d.decisao,d.motivo,d.ator_id,d.criado_em
    from pcm.sso_listar_revisoes_validacao_os(p_cliente_id,p_retorno_id,p_antes,p_limite) d;
end; $$;
revoke all on function pcm.sso_listar_decisoes_retorno_mediado(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_decisoes_retorno_mediado(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_listar_pendencias_contexto_mediado(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,alvo_tipo text,alvo_id uuid,alvo_nome text,pergunta text,observacao text,estado text,revisao integer,criado_em timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  select habilitado into v_habilitado from pcm.sso_mediacao_pendencias_retorno_gate where pcm.sso_mediacao_pendencias_retorno_gate.id for share;
  if v_habilitado is distinct from true then raise exception 'mediacao_pendencias_bloqueada' using errcode='55000'; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.alvo_tipo,p.alvo_id,p.alvo_nome,p.pergunta,p.observacao,p.estado,p.revisao,p.criado_em
    from pcm.sso_listar_pendencias_contexto(p_cliente_id,p_apos,p_limite) p;
end; $$;
revoke all on function pcm.sso_listar_pendencias_contexto_mediado(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_pendencias_contexto_mediado(uuid,uuid,integer) to authenticated;
