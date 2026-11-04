-- ADR-0981: consulta privada das propostas da OS atribuída; não autoriza devolução.
create function pcm.sso_continuacoes_para_parcela(p_cliente_id uuid,p_ciclo_id uuid,p_apos uuid,p_limite integer)
returns table(proposta_id uuid,parcela_id uuid,os_id uuid,chamado_id uuid,chamado_revision bigint,descricao_restante text,minutos_restantes integer,
  situacao text,proposta_sha256 text,vinculo_declarado_atual boolean)
language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_continuacao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_ciclo_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id for share;
  if v_ciclo.id is null or not exists(select 1 from pcm.chamado_escopo_parcelas p where p.id=v_ciclo.parcela_id and p.chamado_id=v_chamado.id) then raise exception 'ciclo_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select cp.id,v_ciclo.parcela_id,cp.os_anterior_id,v_chamado.id,v_chamado.sso_revisao,cp.descricao_restante,cp.minutos_restantes,
    cp.situacao,h.hash,exists(select 1 from pcm.sso_continuacao_parcela_vinculos vi where vi.cliente_id=p_cliente_id and vi.ciclo_id=p_ciclo_id and vi.parcela_id=v_ciclo.parcela_id and vi.proposta_id=cp.id and vi.proposta_sha256=h.hash)
  from pcm.chamado_continuacoes_propostas cp
  join pcm.sso_atribuicoes_parcela a on a.parcela_id=v_ciclo.parcela_id and a.os_id=cp.os_anterior_id and a.chamado_id=v_chamado.id and a.cliente_id=p_cliente_id
  join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=a.chamado_id and o.client_id=a.cliente_id and o.deleted_at is null
  cross join lateral (select encode(sha256(convert_to(to_jsonb(cp)::text,'UTF8')),'hex') as hash) h
  where cp.chamado_id=v_chamado.id and (p_apos is null or cp.id>p_apos) order by cp.id limit p_limite;
end; $$;
revoke all on function pcm.sso_continuacoes_para_parcela(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
