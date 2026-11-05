-- ADR-1662: borda aditiva desabilitada; funções e recibos legados permanecem intactos.
create table pcm.sso_aprovacao_versao_esperada_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_aprovacao_versao_esperada_gate(id,habilitado) values(true,false);
alter table pcm.sso_aprovacao_versao_esperada_gate enable row level security;
alter table pcm.sso_aprovacao_versao_esperada_gate force row level security;
revoke all on pcm.sso_aprovacao_versao_esperada_gate from public,anon,authenticated,service_role;

create function pcm.sso_preparar_aprovacao_versao(p_ator uuid,p_cliente uuid,p_plano uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_versao uuid;
begin
  if p_ator is null or p_cliente is null or p_plano is null or p_revisao is null or p_revisao<1
    or auth.uid() is distinct from p_ator then raise exception 'pedido_invalido' using errcode='42501'; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_aprovacao_versao_esperada_gate where id and habilitado for share nowait;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then
    raise exception 'aprovacao_indisponivel' using errcode='42501'; end if;
  select v.id into v_versao from pcm.planos_manutencao p
    join pcm.plano_versoes v on v.plano_id=p.id and v.estado='rascunho'
    where p.id=p_plano and p.cliente_id=p_cliente and p.revisao=p_revisao and p.estado='em_revisao'
    for share of p,v nowait;
  if not found then raise exception 'plano_ou_rascunho_alterado' using errcode='P0011'; end if;
  if auth.uid() is distinct from p_ator or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then
    raise exception 'aprovacao_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('planoId',p_plano,'clienteId',p_cliente,'revision',p_revisao,'versaoId',v_versao);
end; $$;
revoke all on function pcm.sso_preparar_aprovacao_versao(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_preparar_aprovacao_versao(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_aprovar_versao_esperada(p_ator uuid,p_cliente uuid,p_request uuid,p_revisao integer,
  p_plano uuid,p_versao uuid,p_vigencia date,p_revisao_preparada boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_comando pcm.plano_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if p_ator is null or p_cliente is null or p_request is null or p_revisao is null or p_revisao<1
    or p_plano is null or p_versao is null or p_vigencia is null or not isfinite(p_vigencia)
    or p_revisao_preparada is null or auth.uid() is distinct from p_ator then
    raise exception 'pedido_invalido' using errcode='42501'; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_aprovacao_versao_esperada_gate where id and habilitado for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then
    raise exception 'aprovacao_indisponivel' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:'||p_request::text,0)) then
    raise exception 'pedido_em_andamento' using errcode='55P03'; end if;
  if p_revisao_preparada and not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then
    raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03'; end if;
  perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
  if not found then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('tipo','aprovarPlano','expectedRevision',p_revisao,'planoId',p_plano,'vigencia',p_vigencia);
  select * into v_comando from pcm.plano_comandos where request_id=p_request;
  if found then
    if v_comando.actor_id is distinct from p_ator or v_comando.cliente_id is distinct from p_cliente
      or v_comando.payload is distinct from v_payload then raise exception 'pedido_divergente' using errcode='23505'; end if;
    if v_comando.resultado->'linkedIds'->>'versaoId' is distinct from p_versao::text then
      raise exception 'versao_divergente' using errcode='23505'; end if;
  else
    perform 1 from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id
      where p.id=p_plano and p.cliente_id=p_cliente and p.revisao=p_revisao and p.estado='em_revisao'
        and v.id=p_versao and v.estado='rascunho' for update of v;
    if not found then raise exception 'plano_ou_rascunho_alterado' using errcode='P0011'; end if;
  end if;
  if p_revisao_preparada then
    v_resultado:=pcm.sso_aprovar_revisao_mediada(p_ator_id=>p_ator,p_cliente_id=>p_cliente,
      p_request_id=>p_request,p_expected_revision=>p_revisao,p_plano_id=>p_plano,p_vigencia=>p_vigencia);
  else
    v_resultado:=pcm.sso_aprovar_plano(p_request,p_revisao,p_plano,p_vigencia);
  end if;
  if v_resultado->'linkedIds'->>'versaoId' is distinct from p_versao::text then
    raise exception 'versao_divergente' using errcode='23505'; end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean) to authenticated;
