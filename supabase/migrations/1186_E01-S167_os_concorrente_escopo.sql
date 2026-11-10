-- ADR-1035: revisões intermediárias somente se demonstradas por recibos de criação de OS.
create table pcm.sso_os_concorrente_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_os_concorrente_gate(id, habilitado) values(true, false);
create table pcm.sso_os_concorrente_recibos(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null references pcm.chamados(id), revisao_original bigint not null check(revisao_original > 0),
  revisao_execucao bigint not null check(revisao_execucao >= revisao_original), escopo_sha256 text not null check(escopo_sha256 ~ '^[a-f0-9]{64}$')
);
alter table pcm.sso_os_concorrente_gate enable row level security;
alter table pcm.sso_os_concorrente_gate force row level security;
alter table pcm.sso_os_concorrente_recibos enable row level security;
alter table pcm.sso_os_concorrente_recibos force row level security;
revoke all on pcm.sso_os_concorrente_gate, pcm.sso_os_concorrente_recibos from public, anon, authenticated, service_role;
create trigger sso_os_concorrente_recibos_imutaveis before update or delete on pcm.sso_os_concorrente_recibos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();
-- O encadeamento depende de recibos históricos que não possam ser alterados ou removidos.
create trigger sso_chamado_os_comandos_imutaveis before update or delete on pcm.chamado_os_comandos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_converter_os_concorrente(
  p_request_id uuid,p_expected_revision bigint,p_chamado_id uuid,p_cliente_id uuid,p_os_id uuid,
  p_campos jsonb,p_destino text,p_status_hub text,p_escopo_sha256 text,p_ator_esperado uuid
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_ator uuid := auth.uid(); v_anterior pcm.sso_os_concorrente_recibos%rowtype;
  v_atual bigint; v_qtd bigint; v_distintas bigint; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_chamado_id is null or p_cliente_id is null or p_os_id is null
    or p_escopo_sha256 is null or p_escopo_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_os_concorrente_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'criacao_concorrente_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('escopo-conversao:'||p_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_os_concorrente_recibos where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.cliente_id is distinct from p_cliente_id
      or v_anterior.chamado_id is distinct from p_chamado_id or v_anterior.revisao_original is distinct from p_expected_revision
      or v_anterior.escopo_sha256 is distinct from p_escopo_sha256 then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return pcm.sso_converter_chamado_escopo_conferido(p_request_id,v_anterior.revisao_execucao,p_chamado_id,p_cliente_id,p_os_id,p_campos,p_destino,p_status_hub,p_escopo_sha256,p_ator_esperado);
  end if;
  if exists(select 1 from pcm.chamado_os_comandos where request_id=p_request_id) then raise exception 'pedido_sem_recibo_concorrente' using errcode='23505'; end if;
  select c.sso_revisao into v_atual from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  if v_atual < p_expected_revision or v_atual - p_expected_revision > 1000 then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if pcm.sso_hash_escopo_chamado(p_chamado_id) is distinct from p_escopo_sha256 then raise exception 'escopo_alterado' using errcode='40001'; end if;
  select count(*),count(distinct (c.resultado->>'revision')) into v_qtd,v_distintas
    from pcm.chamado_os_comandos c where c.chamado_id=p_chamado_id and c.cliente_id=p_cliente_id
      and c.payload->>'versao'='conversao-integral-v1'
      and c.payload->>'chamadoId'=p_chamado_id::text and c.payload->>'clienteId'=p_cliente_id::text
      and c.payload->>'osId'=c.resultado->>'osId' and c.resultado->>'chamadoId'=p_chamado_id::text
      and c.resultado->>'requestId'=c.request_id::text
      and exists(select 1 from pcm.ordens_servico o where o.id::text=c.resultado->>'osId'
        and o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null)
      and case when c.resultado->>'revision' ~ '^[1-9][0-9]{0,17}$' and c.payload->>'expectedRevision' ~ '^[1-9][0-9]{0,17}$'
        then (c.resultado->>'revision')::numeric = (c.payload->>'expectedRevision')::numeric + 1
          and (c.resultado->>'revision')::numeric > p_expected_revision and (c.resultado->>'revision')::numeric <= v_atual else false end;
  if v_qtd <> v_atual-p_expected_revision or v_distintas <> v_qtd then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  v_resultado:=pcm.sso_converter_chamado_escopo_conferido(p_request_id,v_atual,p_chamado_id,p_cliente_id,p_os_id,p_campos,p_destino,p_status_hub,p_escopo_sha256,p_ator_esperado);
  insert into pcm.sso_os_concorrente_recibos(request_id,ator_id,cliente_id,chamado_id,revisao_original,revisao_execucao,escopo_sha256)
    values(p_request_id,v_ator,p_cliente_id,p_chamado_id,p_expected_revision,v_atual,p_escopo_sha256);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_converter_os_concorrente(uuid,bigint,uuid,uuid,uuid,jsonb,text,text,text,uuid) from public,anon,authenticated,service_role;
