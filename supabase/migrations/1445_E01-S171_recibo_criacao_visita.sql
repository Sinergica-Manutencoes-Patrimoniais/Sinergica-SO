-- ADR-1298: consulta sem escrita da mesma tentativa de criação.
create table pcm.sso_recibo_criacao_visita_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_recibo_criacao_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_recibo_criacao_visita_gate enable row level security;
alter table pcm.sso_recibo_criacao_visita_gate force row level security;
revoke all on pcm.sso_recibo_criacao_visita_gate from public,anon,authenticated,service_role;

create function pcm.sso_recibo_criacao_visita(
  p_ator_id uuid, p_request_id uuid, p_expected_revision integer, p_visita_id uuid, p_cliente_id uuid,
  p_contrato_id uuid, p_area_id uuid, p_local_id uuid, p_inicio_em timestamptz, p_fim_em timestamptz,
  p_fuso text, p_natureza text, p_responsavel_id uuid, p_deslocamento_minutos integer
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_payload jsonb; v_comando pcm.visita_comandos%rowtype;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_expected_revision is distinct from 0
    or p_visita_id is null or p_cliente_id is null or p_inicio_em is null or p_fim_em is null
    or not isfinite(p_inicio_em) or not isfinite(p_fim_em) or p_fim_em <= p_inicio_em
    or nullif(btrim(p_fuso),'') is null or p_natureza is null or p_natureza not in ('regular','extra','reposicao_manual')
    or p_deslocamento_minutos is null or p_deslocamento_minutos < 0 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_recibo_criacao_visita_gate where id and habilitado for share;
  if not found then raise exception 'recibo_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('tipo','criarVisitaRascunho','expectedRevision',p_expected_revision,
    'visitaId',p_visita_id,'clienteId',p_cliente_id,'contratoId',p_contrato_id,'areaId',p_area_id,
    'localId',p_local_id,'inicioEm',p_inicio_em,'fimEm',p_fim_em,'fuso',p_fuso,
    'natureza',p_natureza,'responsavelId',p_responsavel_id,'deslocamentoMinutos',p_deslocamento_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into v_comando from pcm.visita_comandos where request_id=p_request_id and actor_id=p_ator_id and cliente_id=p_cliente_id and payload=v_payload;
  if not found or not exists(select 1 from pcm.visitas v where v.id=p_visita_id and v.cliente_id=p_cliente_id)
    then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return v_comando.resultado;
end; $$;
revoke all on function pcm.sso_recibo_criacao_visita(uuid,uuid,integer,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_criacao_visita(uuid,uuid,integer,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,text,uuid,integer) to authenticated;
