-- ADR-0895. Listagem independente do gate de transporte, desligada por padrão.
create table pcm.sso_listagem_cronograma_legado_gate (
  id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into pcm.sso_listagem_cronograma_legado_gate(id,habilitado) values(true,false);
alter table pcm.sso_listagem_cronograma_legado_gate enable row level security;
alter table pcm.sso_listagem_cronograma_legado_gate force row level security;
revoke all on pcm.sso_listagem_cronograma_legado_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_cronogramas_legados(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,fonte_id text,revisao integer,criado_em timestamptz,reconciliado boolean)
language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select g.habilitado into v_habilitado from pcm.sso_listagem_cronograma_legado_gate g where g.id for share;
  if v_habilitado is distinct from true then raise exception 'listagem_legada_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select l.id,l.fonte_id,l.revisao,l.criado_em,exists(select 1 from pcm.sso_reconciliacoes_cronograma r where r.lote_id=l.id and r.cliente_id=p_cliente_id)
    from pcm.cronograma_importacao_lotes l where l.cliente_id=p_cliente_id and (p_apos is null or l.id>p_apos)
    order by l.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_cronogramas_legados(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_cronogramas_legados(uuid,uuid,integer) to authenticated;
