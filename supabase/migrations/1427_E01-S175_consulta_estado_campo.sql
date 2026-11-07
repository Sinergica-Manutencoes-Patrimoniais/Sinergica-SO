-- ADR-1280: visão privada sob gate fechado, sem alterar estado operacional.
create table pcm.sso_consulta_estado_campo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_consulta_estado_campo_gate(id,habilitado) values(true,false);
alter table pcm.sso_consulta_estado_campo_gate enable row level security;
alter table pcm.sso_consulta_estado_campo_gate force row level security;
revoke all on pcm.sso_consulta_estado_campo_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_estado_campo(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,chamado_id uuid,provisorio boolean,status_os text,status_campo text,ordem_externa text,conflitos bigint,validacao_comprovada boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_consulta_estado_campo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.os_id,o.chamado_id,p.provisorio and o.chamado_id=p.chamado_id,o.status,ev.projecao->>'statusCampo',ev.ordem_externa::text,
    (select count(*) from pcm.sso_origem_campo_entregas d where d.integracao=p.integracao and d.task_id=p.task_id and d.estado in ('conflito_regressao','conflito_ordem')),false
    from pcm.sso_origem_campo_processamentos p join pcm.ordens_servico o on o.id=p.os_id and o.client_id=p.cliente_id and o.deleted_at is null
    join lateral (select x.projecao,x.ordem_externa from pcm.sso_origem_campo_eventos x where x.integracao=p.integracao and x.task_id=p.task_id and x.estado='aceito' order by x.ordem_externa desc limit 1) ev on true
    where p.cliente_id=p_cliente_id and (p_apos is null or p.os_id>p_apos) order by p.os_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_estado_campo(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_estado_campo(uuid,uuid,uuid,integer) to authenticated;
