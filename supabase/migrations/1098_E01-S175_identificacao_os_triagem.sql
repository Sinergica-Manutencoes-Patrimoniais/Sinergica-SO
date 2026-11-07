-- ADR-0945: identificação legível da mesma fonte de OS; gate fechado.
create table pcm.sso_os_triagem_detalhe_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_os_triagem_detalhe_gate(id,habilitado) values(true,false);
alter table pcm.sso_os_triagem_detalhe_gate enable row level security;
alter table pcm.sso_os_triagem_detalhe_gate force row level security;
revoke all on pcm.sso_os_triagem_detalhe_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_os_triagem_detalhada(p_envelope_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text) language plpgsql volatile security definer set search_path='' as $$
declare v_env pcm.origem_campo_inbox%rowtype;v_triagem pcm.sso_origem_campo_triagens%rowtype;v_gate boolean;
begin
  if p_envelope_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select g.habilitado into v_gate from pcm.sso_os_triagem_detalhe_gate g where g.id for share;
  if v_gate is distinct from true then raise exception 'consulta_triagem_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or config.sso_autorizar_triagem_global() is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_env from pcm.origem_campo_inbox where pcm.origem_campo_inbox.id=p_envelope_id;
  select * into v_triagem from pcm.sso_origem_campo_triagens where envelope_id=p_envelope_id;
  if v_env.id is null or v_triagem.envelope_id is null or v_env.integracao<>'auvo' or config.sso_autorizar_acao('integracao.reconciliar',v_triagem.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select o.id,o.numero::text,o.titulo::text from pcm.ordens_servico o
    where o.client_id=v_triagem.cliente_id and o.auvo_task_id=v_env.task_id and o.deleted_at is null and (p_apos is null or o.id>p_apos)
    order by o.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_os_triagem_detalhada(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_os_triagem_detalhada(uuid,uuid,integer) to authenticated;
