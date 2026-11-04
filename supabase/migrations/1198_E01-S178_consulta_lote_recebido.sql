-- ADR-1047: metadados mínimos, gate fechado e EXECUTE privado.
create table pcm.sso_consulta_lote_recebido_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_consulta_lote_recebido_gate(id,habilitado) values(true,false);
alter table pcm.sso_consulta_lote_recebido_gate enable row level security;
alter table pcm.sso_consulta_lote_recebido_gate force row level security;
revoke all on pcm.sso_consulta_lote_recebido_gate from public,anon,authenticated,service_role;
create function pcm.sso_consultar_lote_recebido(p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid)
returns table(id uuid,origem text,chave_origem text,revisao integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lote_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_consulta_lote_recebido_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select b.id,b.origem,b.chave_origem,b.revisao,b.criado_em from pcm.sso_levantamentos b where b.id=p_lote_id and b.cliente_id=p_cliente_id;
  if not found then raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_consultar_lote_recebido(uuid,uuid,uuid) from public,anon,authenticated,service_role;
