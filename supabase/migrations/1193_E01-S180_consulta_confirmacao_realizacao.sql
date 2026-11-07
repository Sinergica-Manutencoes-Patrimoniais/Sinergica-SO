-- ADR-1042: confirmação sem caminho do comprovante ou reexecução do comando.
create table pcm.sso_consulta_realizacao_despesa_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_consulta_realizacao_despesa_gate(id,habilitado) values(true,false);
alter table pcm.sso_consulta_realizacao_despesa_gate enable row level security;
alter table pcm.sso_consulta_realizacao_despesa_gate force row level security;
revoke all on pcm.sso_consulta_realizacao_despesa_gate from public,anon,authenticated,service_role;
create function pcm.sso_consultar_realizacao_despesa(
  p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_despesa_id uuid,p_request_id uuid,
  p_revision integer,p_valor bigint,p_objeto_id uuid
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_comando pcm.despesa_visita_comandos%rowtype;v_payload jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_visita_id is null or p_despesa_id is null
    or p_request_id is null or p_revision is null or p_revision<1 or p_valor is null or p_valor not between 0 and 9007199254740991 or p_objeto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_consulta_realizacao_despesa_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.despesas_visita d where d.id=p_despesa_id and d.cliente_id=p_cliente_id and d.visita_id=p_visita_id for share;
  if not found then raise exception 'confirmacao_indisponivel' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('operacao','realizar','despesaId',p_despesa_id,'expectedRevision',p_revision,'realizadoCentavos',p_valor,'comprovanteObjetoId',p_objeto_id);
  select * into v_comando from pcm.despesa_visita_comandos where request_id=p_request_id and actor_id=p_ator_id and cliente_id=p_cliente_id;
  if not found or v_comando.payload is distinct from v_payload or not exists(select 1 from pcm.despesa_visita_realizacoes r
    where r.request_id=p_request_id and r.despesa_id=p_despesa_id and r.ator_id=p_ator_id and r.revisao=p_revision+1
      and r.valor_centavos=p_valor and r.comprovante_objeto_id=p_objeto_id) then raise exception 'confirmacao_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'visitaId',p_visita_id,'despesaId',p_despesa_id,'revision',p_revision+1,'confirmada',true,'integridadeBytesComprovada',false);
end;
$$;
revoke all on function pcm.sso_consultar_realizacao_despesa(uuid,uuid,uuid,uuid,uuid,integer,bigint,uuid) from public,anon,authenticated,service_role;
