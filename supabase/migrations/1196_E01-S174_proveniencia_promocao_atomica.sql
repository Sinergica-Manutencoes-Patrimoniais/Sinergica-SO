-- ADR-1045: registro transacional privado; não converte operações anteriores.
create table pcm.sso_promocoes_continuidade_atomicas (
  promocao_request_id uuid primary key,
  registro_request_id uuid not null unique,
  retorno_id uuid not null unique references pcm.sso_retornos_parciais(id),
  cliente_id uuid not null references pcm.clientes(id),
  ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  check (promocao_request_id <> registro_request_id)
);
alter table pcm.sso_promocoes_continuidade_atomicas enable row level security;
alter table pcm.sso_promocoes_continuidade_atomicas force row level security;
revoke all on pcm.sso_promocoes_continuidade_atomicas from public,anon,authenticated,service_role;
create trigger sso_promocoes_continuidade_atomicas_imutaveis
  before update or delete on pcm.sso_promocoes_continuidade_atomicas
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

alter function pcm.sso_promover_e_registrar_continuacao_parcial(uuid,uuid,uuid,uuid,uuid,integer,uuid,bigint,uuid,uuid,uuid,text,text,text)
  rename to sso_promover_e_registrar_continuacao_nucleo_1195;
revoke all on function pcm.sso_promover_e_registrar_continuacao_nucleo_1195(uuid,uuid,uuid,uuid,uuid,integer,uuid,bigint,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;

create function pcm.sso_promover_e_registrar_continuacao_parcial(
  p_promocao_request_id uuid,p_registro_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_retorno_revision integer,
  p_chamado_anterior_id uuid,p_chamado_anterior_revision bigint,p_chamado_id uuid,p_parcela_id uuid,p_ciclo_id uuid,
  p_titulo text,p_descricao text,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_anterior pcm.sso_promocoes_continuidade_atomicas%rowtype; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null or p_retorno_id is null
    or p_promocao_request_id is null or p_registro_request_id is null or p_promocao_request_id=p_registro_request_id then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_promocao_retorno_parcial_gate where id and habilitado for share;
  if not found then raise exception 'promocao_parcial_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_retorno_parcial_gate where id and habilitado for share;
  if not found then raise exception 'retorno_parcial_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.chamado_os_gate where id and habilitado for share;
  if not found then raise exception 'chamado_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_continuacao_devolvida_gate where id and habilitado for share;
  if not found then raise exception 'continuacao_devolvida_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('backlog.promover',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('promocao-retorno-parcial:'||p_promocao_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('continuacao-devolvida:'||p_registro_request_id::text,0));
  select * into v_anterior from pcm.sso_promocoes_continuidade_atomicas where promocao_request_id=p_promocao_request_id;
  if found then
    if v_anterior.registro_request_id is distinct from p_registro_request_id or v_anterior.ator_id is distinct from p_ator_id
      or v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.retorno_id is distinct from p_retorno_id then
      raise exception 'request_id_conflitante' using errcode='23505';
    end if;
  elsif exists(select 1 from pcm.sso_promocoes_continuidade_atomicas where registro_request_id=p_registro_request_id or retorno_id=p_retorno_id)
    or exists(select 1 from pcm.sso_promocoes_retorno_parcial where request_id=p_promocao_request_id or retorno_id=p_retorno_id)
    or exists(select 1 from pcm.sso_continuacao_devolvida_comandos where request_id=p_registro_request_id or retorno_id=p_retorno_id) then
    raise exception 'operacao_previa_nao_atomica' using errcode='23505';
  end if;
  v_resultado:=pcm.sso_promover_e_registrar_continuacao_nucleo_1195(p_promocao_request_id,p_registro_request_id,p_ator_id,p_cliente_id,
    p_retorno_id,p_retorno_revision,p_chamado_anterior_id,p_chamado_anterior_revision,p_chamado_id,p_parcela_id,p_ciclo_id,p_titulo,p_descricao,p_motivo);
  if v_anterior.promocao_request_id is null then
    insert into pcm.sso_promocoes_continuidade_atomicas(promocao_request_id,registro_request_id,retorno_id,cliente_id,ator_id)
      values(p_promocao_request_id,p_registro_request_id,p_retorno_id,p_cliente_id,p_ator_id);
  end if;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_promover_e_registrar_continuacao_parcial(uuid,uuid,uuid,uuid,uuid,integer,uuid,bigint,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;
