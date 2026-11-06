-- ADR-1036: transição explícita, sem alterar a parcela ou criar OS.
alter table pcm.chamado_continuacoes_propostas drop constraint chamado_continuacoes_propostas_situacao_check;
alter table pcm.chamado_continuacoes_propostas add constraint chamado_continuacoes_propostas_situacao_check
  check(situacao in ('pendente','rejeitada','executada','devolvida_backlog'));
create table pcm.sso_continuacao_devolvida_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_continuacao_devolvida_gate(id,habilitado) values(true,false);
create table pcm.sso_continuacao_devolvida_permissoes(txid bigint not null, proposta_id uuid not null, primary key(txid,proposta_id));
create table pcm.sso_continuacao_devolvida_comandos(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  retorno_id uuid not null unique references pcm.sso_retornos_parciais(id), payload jsonb not null, resultado jsonb not null
);
alter table pcm.sso_continuacao_devolvida_gate enable row level security;
alter table pcm.sso_continuacao_devolvida_gate force row level security;
alter table pcm.sso_continuacao_devolvida_permissoes enable row level security;
alter table pcm.sso_continuacao_devolvida_permissoes force row level security;
alter table pcm.sso_continuacao_devolvida_comandos enable row level security;
alter table pcm.sso_continuacao_devolvida_comandos force row level security;
revoke all on pcm.sso_continuacao_devolvida_gate,pcm.sso_continuacao_devolvida_permissoes,pcm.sso_continuacao_devolvida_comandos from public,anon,authenticated,service_role;
create trigger sso_continuacao_devolvida_comandos_imutaveis before update or delete on pcm.sso_continuacao_devolvida_comandos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create or replace function pcm.sso_proteger_continuacao_devolvida() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from pcm.sso_retornos_parciais r where r.proposta_id=old.id and r.chamado_id=old.chamado_id) then
    if tg_op='UPDATE' and old.situacao='pendente' and new.situacao='devolvida_backlog'
      and (to_jsonb(new)-'situacao') is not distinct from (to_jsonb(old)-'situacao')
      and exists(select 1 from pcm.sso_continuacao_devolvida_permissoes p where p.txid=pg_catalog.txid_current() and p.proposta_id=old.id) then return new; end if;
    raise exception 'continuacao_transferida_ao_backlog' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.situacao='devolvida_backlog' then raise exception 'retorno_parcial_ausente' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_continuacao_devolvida() from public,anon,authenticated,service_role;

create function pcm.sso_impedir_criacao_continuacao_devolvida() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.situacao='devolvida_backlog' then raise exception 'transicao_auditada_obrigatoria' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_impedir_criacao_continuacao_devolvida() from public,anon,authenticated,service_role;
create trigger sso_impedir_criacao_continuacao_devolvida before insert on pcm.chamado_continuacoes_propostas
  for each row execute function pcm.sso_impedir_criacao_continuacao_devolvida();

create function pcm.sso_registrar_continuacao_devolvida(
  p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_retorno_id uuid,p_expected_revision bigint,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_retorno pcm.sso_retornos_parciais%rowtype;v_proposta pcm.chamado_continuacoes_propostas%rowtype;
  v_chamado pcm.chamados%rowtype;v_anterior pcm.sso_continuacao_devolvida_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_request_id is null or p_retorno_id is null
    or p_expected_revision is null or p_expected_revision<1 or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_continuacao_devolvida_gate where id and habilitado for share;
  if not found then raise exception 'continuacao_devolvida_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'revision',p_expected_revision,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('continuacao-devolvida:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_continuacao_devolvida_comandos where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from p_ator_id or v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_anterior.resultado;
  end if;
  select * into v_retorno from pcm.sso_retornos_parciais where id=p_retorno_id and cliente_id=p_cliente_id;
  if not found then raise exception 'retorno_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_retorno.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  if v_chamado.sso_revisao is distinct from p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_retorno from pcm.sso_retornos_parciais where id=p_retorno_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id for update;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=v_retorno.proposta_id and chamado_id=v_chamado.id for update;
  if v_proposta.id is null or v_proposta.situacao<>'pendente' or v_proposta.os_continuacao_id is not null
    or v_retorno.estado is distinct from 'promovido' or v_retorno.descricao_restante is distinct from v_proposta.descricao_restante
    or v_retorno.minutos_restantes is distinct from v_proposta.minutos_restantes
    or encode(sha256(convert_to(to_jsonb(v_proposta)::text,'UTF8')),'hex') is distinct from v_retorno.proposta_sha256 then
    raise exception 'continuacao_ou_retorno_inconsistente' using errcode='23514';
  end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_continuacao_devolvida_permissoes(txid,proposta_id) values(pg_catalog.txid_current(),v_proposta.id);
  update pcm.chamado_continuacoes_propostas set situacao='devolvida_backlog' where id=v_proposta.id;
  delete from pcm.sso_continuacao_devolvida_permissoes where txid=pg_catalog.txid_current() and proposta_id=v_proposta.id;
  update pcm.chamados set updated_at=now(),updated_by=p_ator_id where id=v_chamado.id returning * into v_chamado;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'retornoId',p_retorno_id,'propostaId',v_proposta.id,
    'chamadoId',v_chamado.id,'revision',v_chamado.sso_revisao,'situacao','devolvida_backlog','parcelaAlterada',false,'osCriada',false,'paradaComprovada',false);
  insert into pcm.sso_continuacao_devolvida_comandos(request_id,ator_id,cliente_id,retorno_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,p_retorno_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'backlog.continuacao_transferida','chamado_continuacoes_propostas',v_proposta.id,v_resultado||jsonb_build_object('motivo',v_motivo));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_registrar_continuacao_devolvida(uuid,uuid,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
