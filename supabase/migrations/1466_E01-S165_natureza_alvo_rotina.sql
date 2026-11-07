-- ADR-1320: classificação explícita sem migrar nem inferir dados legados.
alter table pcm.rotinas_manutencao add column natureza_tecnica text
  check (natureza_tecnica is null or (alvo_tipo = 'componente' and natureza_tecnica in ('equipamento','componente')));

create table pcm.sso_natureza_alvo_rotina_gate (
  id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into pcm.sso_natureza_alvo_rotina_gate(id,habilitado) values(true,false);
alter table pcm.sso_natureza_alvo_rotina_gate enable row level security;
alter table pcm.sso_natureza_alvo_rotina_gate force row level security;
revoke all on pcm.sso_natureza_alvo_rotina_gate from public,anon,authenticated,service_role;

create function pcm.sso_limpar_natureza_alvo_alterado() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.alvo_tipo is distinct from old.alvo_tipo or new.equipamento_id is distinct from old.equipamento_id then
    new.natureza_tecnica := null;
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_limpar_natureza_alvo_alterado() from public,anon,authenticated,service_role;
create trigger sso_limpar_natureza_alvo_alterado before update on pcm.rotinas_manutencao
for each row execute function pcm.sso_limpar_natureza_alvo_alterado();

create function pcm.sso_declarar_natureza_alvo_rotina(
  p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rotina_id uuid,
  p_expected_revision integer,p_natureza text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;
  v_comando pcm.plano_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_antes text;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null
    or p_plano_id is null or p_rotina_id is null or p_expected_revision is null or p_expected_revision<1
    or p_natureza is null or p_natureza not in ('equipamento','componente') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_natureza_alvo_rotina_gate where id and habilitado for share;
  if not found then raise exception 'natureza_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('tipo','declararNaturezaAlvo','clienteId',p_cliente_id,'planoId',p_plano_id,
    'rotinaId',p_rotina_id,'expectedRevision',p_expected_revision,'natureza',p_natureza);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:'||p_request_id::text,0));
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_comando from pcm.plano_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from p_ator_id or v_comando.cliente_id is distinct from p_cliente_id
      or v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_plano.estado<>'rascunho' and not (v_plano.estado='em_revisao' and coalesce((select habilitado from pcm.sso_edicao_revisao_gate where id),false))
    then raise exception 'plano_nao_editavel' using errcode='23514'; end if;
  select r.* into v_rotina from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id
    where r.id=p_rotina_id and r.plano_id=p_plano_id and v.estado='rascunho' for update of r;
  if not found or v_rotina.alvo_tipo<>'componente' or v_rotina.equipamento_id is null then raise exception 'alvo_incompativel' using errcode='23514'; end if;
  perform 1 from pcm.equipamentos e where e.id=v_rotina.equipamento_id and e.client_id=p_cliente_id and e.ativo and e.deleted_at is null for share;
  if not found then raise exception 'alvo_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_antes:=v_rotina.natureza_tecnica;
  update pcm.rotinas_manutencao set natureza_tecnica=p_natureza where id=p_rotina_id;
  update pcm.planos_manutencao set revisao=revisao+1,updated_at=now(),updated_by=p_ator_id where id=p_plano_id returning * into v_plano;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'rotinaId',p_rotina_id,
    'versaoId',v_rotina.versao_id,'alvoId',v_rotina.equipamento_id,'natureza',p_natureza,'revision',v_plano.revisao);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'rotina.natureza_alvo_declarada',
    'rotinas_manutencao',p_rotina_id,jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'antes',v_antes,'depois',p_natureza));
  insert into pcm.plano_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,v_payload,v_resultado);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_natureza_alvo_rotina(uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_natureza_alvo_rotina(uuid,uuid,uuid,uuid,uuid,integer,text) to authenticated;
