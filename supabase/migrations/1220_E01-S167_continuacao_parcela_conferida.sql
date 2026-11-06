-- ADR-1071: continuidade rastreável; sem envio externo e sem gate aberto.
create table pcm.sso_continuacao_os_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_continuacao_os_parcela_gate(id,habilitado) values(true,false);
create table pcm.sso_continuacoes_os_parcela (
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null references pcm.chamados(id),parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),
  proposta_id uuid not null unique references pcm.chamado_continuacoes_propostas(id),os_anterior_id uuid not null references pcm.ordens_servico(id),
  os_nova_id uuid not null unique references pcm.ordens_servico(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),
  unique(parcela_id,os_anterior_id)
);
alter table pcm.sso_continuacao_os_parcela_gate enable row level security;
alter table pcm.sso_continuacao_os_parcela_gate force row level security;
alter table pcm.sso_continuacoes_os_parcela enable row level security;
alter table pcm.sso_continuacoes_os_parcela force row level security;
revoke all on pcm.sso_continuacao_os_parcela_gate,pcm.sso_continuacoes_os_parcela from public,anon,authenticated,service_role;
create trigger sso_continuacoes_os_parcela_imutaveis before update or delete on pcm.sso_continuacoes_os_parcela
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Fonte comum: atribuição inicial ou continuidade já registrada, sem inferência temporal.
create function pcm.sso_parcelas_da_os_cadeia(p_cliente_id uuid,p_chamado_id uuid,p_os_id uuid)
returns table(parcela_id uuid) language sql stable security definer set search_path='' as $$
  select a.parcela_id from pcm.sso_atribuicoes_parcela a
    where a.cliente_id=p_cliente_id and a.chamado_id=p_chamado_id and a.os_id=p_os_id
  union all
  select v.parcela_id from pcm.sso_continuacoes_os_parcela v
    join pcm.chamado_continuacoes_propostas p on p.id=v.proposta_id and p.chamado_id=v.chamado_id
      and p.os_anterior_id=v.os_anterior_id and p.os_continuacao_id=v.os_nova_id and p.situacao='executada'
    where v.cliente_id=p_cliente_id and v.chamado_id=p_chamado_id and v.os_nova_id=p_os_id
$$;
revoke all on function pcm.sso_parcelas_da_os_cadeia(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_aprovar_continuacao_parcela_conferida(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_chamado_id uuid,
  p_chamado_revision bigint,p_parcela_id uuid,p_proposta_id uuid,p_proposta_sha256 text,p_os_anterior_id uuid,p_os_atualizada_em timestamptz,p_os_nova_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ant pcm.sso_continuacoes_os_parcela%rowtype;v_c pcm.chamados%rowtype;v_p pcm.chamado_escopo_parcelas%rowtype;
  v_proposta pcm.chamado_continuacoes_propostas%rowtype;v_os pcm.ordens_servico%rowtype;v_nova pcm.ordens_servico%rowtype;
  v_hash text;v_payload jsonb;v_recebido jsonb;v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_chamado_id is null
    or p_chamado_revision is null or p_chamado_revision<1 or p_parcela_id is null or p_proposta_id is null or p_os_anterior_id is null
    or p_os_nova_id is null or p_os_nova_id=p_os_anterior_id or p_os_atualizada_em is null or not isfinite(p_os_atualizada_em)
    or p_proposta_sha256 is null or p_proposta_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_continuacao_os_parcela_gate where id and habilitado for share;
  if not found then raise exception 'continuacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_cobertura_continuacao_gate where id and habilitado for share;
  if not found then raise exception 'cobertura_continuacao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'chamadoRevision',p_chamado_revision,'parcelaId',p_parcela_id,
    'propostaId',p_proposta_id,'propostaSha256',p_proposta_sha256,'osAnteriorId',p_os_anterior_id,'osAtualizadaEm',p_os_atualizada_em,'osNovaId',p_os_nova_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-continuacao-os-parcela:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_continuacoes_os_parcela where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    if not exists(select 1 from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null)
      or not exists(select 1 from pcm.ordens_servico where id=p_os_nova_id and chamado_id=p_chamado_id and client_id=p_cliente_id and deleted_at is null) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    return v_ant.resultado;
  end if;
  select * into v_c from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  if v_c.sso_revisao is distinct from p_chamado_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_p from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=p_chamado_id for update;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=p_proposta_id and chamado_id=p_chamado_id for update;
  select * into v_os from pcm.ordens_servico where id=p_os_anterior_id and chamado_id=p_chamado_id and client_id=p_cliente_id and deleted_at is null for update;
  if v_p.id is null or v_p.situacao<>'pendente' or v_proposta.id is null or v_proposta.situacao<>'pendente' or v_proposta.os_continuacao_id is not null
    or v_proposta.os_anterior_id is distinct from p_os_anterior_id or v_os.id is null or v_os.status<>'finalizado' or v_os.updated_at is distinct from p_os_atualizada_em
    or (select count(*) from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,p_chamado_id,p_os_anterior_id))<>1
    or not exists(select 1 from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,p_chamado_id,p_os_anterior_id) a where a.parcela_id=p_parcela_id)
    or exists(select 1 from pcm.sso_retornos_parciais where proposta_id=p_proposta_id)
    or exists(select 1 from pcm.sso_continuacoes_os_parcela where parcela_id=p_parcela_id and os_anterior_id=p_os_anterior_id) then raise exception 'proposta_ou_atribuicao_indisponivel' using errcode='23514'; end if;
  v_hash:=encode(sha256(convert_to(to_jsonb(v_proposta)::text,'UTF8')),'hex');
  if v_hash is distinct from p_proposta_sha256 then raise exception 'proposta_alterada' using errcode='40001'; end if;
  if exists(select 1 from pcm.sso_ciclos_backlog where parcela_id=p_parcela_id) then
    perform 1 from pcm.sso_ciclos_backlog c join pcm.sso_continuacao_parcela_vinculos v on v.ciclo_id=c.id and v.parcela_id=c.parcela_id
      where c.parcela_id=p_parcela_id and c.cliente_id=p_cliente_id and c.chamado_id=p_chamado_id and c.estado='em_tratamento'
        and v.proposta_id=p_proposta_id and v.os_id=p_os_anterior_id and v.proposta_sha256=v_hash for share of c,v;
    if not found then raise exception 'vinculo_backlog_indisponivel' using errcode='23514'; end if;
  elsif not exists(select 1 from pcm.sso_atribuicoes_diretas d join pcm.sso_atribuicoes_parcela a on a.request_id=d.request_id
    where d.parcela_id=p_parcela_id and a.chamado_id=p_chamado_id and a.cliente_id=p_cliente_id) then raise exception 'origem_nao_comprovada' using errcode='23514'; end if;
  v_recebido:=pcm.sso_aprovar_continuacao_chamado(gen_random_uuid(),gen_random_uuid(),p_cliente_id,p_chamado_id,p_chamado_revision,p_proposta_id,p_os_nova_id);
  if v_recebido->>'propostaId' is distinct from p_proposta_id::text or v_recebido->>'osAnteriorId' is distinct from p_os_anterior_id::text
    or v_recebido->>'osContinuacaoId' is distinct from p_os_nova_id::text or (v_recebido->>'minutosRestantes')::integer is distinct from v_proposta.minutos_restantes then raise exception 'recibo_invalido' using errcode='23514'; end if;
  select * into v_nova from pcm.ordens_servico where id=p_os_nova_id and chamado_id=p_chamado_id and client_id=p_cliente_id and deleted_at is null for update;
  if not found or v_nova.descricao is distinct from v_proposta.descricao_restante or v_nova.status<>'solicitacao' or v_nova.auvo_task_id is not null then raise exception 'os_nova_invalida' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'chamadoId',p_chamado_id,'parcelaId',p_parcela_id,'propostaId',p_proposta_id,'osAnteriorId',p_os_anterior_id,
    'osContinuacaoId',p_os_nova_id,'minutosRestantes',v_proposta.minutos_restantes,'revision',(v_recebido->>'revision')::bigint,'execucaoComprovada',false,'envioAuvo',false);
  insert into pcm.sso_continuacoes_os_parcela(request_id,ator_id,cliente_id,chamado_id,parcela_id,proposta_id,os_anterior_id,os_nova_id,payload,resultado)
    values(p_request_id,p_ator_id,p_cliente_id,p_chamado_id,p_parcela_id,p_proposta_id,p_os_anterior_id,p_os_nova_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'chamado.continuacao_parcela_aprovada','chamados',p_chamado_id,v_resultado);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_aprovar_continuacao_parcela_conferida(uuid,uuid,uuid,uuid,bigint,uuid,uuid,text,uuid,timestamptz,uuid) from public,anon,authenticated,service_role;
