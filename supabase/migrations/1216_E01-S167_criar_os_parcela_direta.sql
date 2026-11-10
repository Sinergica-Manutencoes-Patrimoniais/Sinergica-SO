-- ADR-1068: criação e atribuição transacionais; sem gate aberto ou acesso operacional.
create table pcm.sso_criar_os_parcela_direta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_criar_os_parcela_direta_gate(id,habilitado) values(true,false);
create table pcm.sso_os_parcela_direta_comandos (
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null references pcm.chamados(id),parcela_id uuid not null unique references pcm.chamado_escopo_parcelas(id),
  os_id uuid not null unique references pcm.ordens_servico(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_criar_os_parcela_direta_gate enable row level security;
alter table pcm.sso_criar_os_parcela_direta_gate force row level security;
alter table pcm.sso_os_parcela_direta_comandos enable row level security;
alter table pcm.sso_os_parcela_direta_comandos force row level security;
revoke all on pcm.sso_criar_os_parcela_direta_gate,pcm.sso_os_parcela_direta_comandos from public,anon,authenticated,service_role;
create trigger sso_os_parcela_direta_comandos_imutaveis before update or delete on pcm.sso_os_parcela_direta_comandos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_criar_os_parcela_direta(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_chamado_id uuid,p_parcela_id uuid,p_os_id uuid,
  p_chamado_revision bigint,p_escopo_revision bigint,p_escopo_sha256 text,p_descricao_parcela text,p_campos jsonb,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_anterior pcm.sso_os_parcela_direta_comandos%rowtype;v_chamado pcm.chamados%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_escopo pcm.chamado_escopo_composicoes%rowtype;v_os pcm.ordens_servico%rowtype;v_payload jsonb;v_criada jsonb;v_atribuida jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_chamado_id is null or p_parcela_id is null or p_os_id is null
    or p_chamado_revision is null or p_chamado_revision<1 or p_escopo_revision is null or p_escopo_revision<1 or p_escopo_sha256 is null or p_escopo_sha256 !~ '^[a-f0-9]{64}$'
    or p_descricao_parcela is null or length(btrim(p_descricao_parcela)) not between 1 and 1000 or jsonb_typeof(p_campos) is distinct from 'object'
    or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_criar_os_parcela_direta_gate where id and habilitado for share;
  if not found then raise exception 'criacao_os_parcela_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'parcelaId',p_parcela_id,'osId',p_os_id,
    'chamadoRevision',p_chamado_revision,'escopoRevision',p_escopo_revision,'escopoSha256',p_escopo_sha256,'descricaoParcela',p_descricao_parcela,'campos',p_campos,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-os-parcela:'||p_request_id::text,0));
  if exists(select 1 from pcm.sso_os_parcela_backlog_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  select * into v_anterior from pcm.sso_os_parcela_direta_comandos where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from p_ator_id or v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    if not exists(select 1 from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null)
      or not exists(select 1 from pcm.ordens_servico where id=p_os_id and chamado_id=p_chamado_id and client_id=p_cliente_id and deleted_at is null) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    return v_anterior.resultado;
  end if;
  select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id for update;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=p_chamado_id for update;
  if v_chamado.sso_revisao is distinct from p_chamado_revision or v_escopo.revisao is distinct from p_escopo_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_parcela.id is null or v_parcela.situacao<>'pendente' or v_parcela.descricao is distinct from p_descricao_parcela
    or exists(select 1 from pcm.sso_backlog_parcelas where parcela_id=p_parcela_id)
    or exists(select 1 from pcm.sso_ciclos_backlog where parcela_id=p_parcela_id)
    or exists(select 1 from pcm.sso_atribuicoes_parcela where parcela_id=p_parcela_id) then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
  if p_campos->>'tecnico_funcionario_id' is not null or p_campos->>'data_agendada' is not null then raise exception 'agendamento_nao_permitido' using errcode='23514'; end if;
  v_criada:=pcm.sso_converter_chamado_escopo_conferido(gen_random_uuid(),p_chamado_revision,p_chamado_id,p_cliente_id,p_os_id,p_campos,'convertido_os',null,p_escopo_sha256,p_ator_id);
  if v_criada->>'osId' is distinct from p_os_id::text or v_criada->>'chamadoId' is distinct from p_chamado_id::text then raise exception 'recibo_os_invalido' using errcode='23514'; end if;
  update pcm.ordens_servico set descricao=v_parcela.descricao,updated_at=now(),updated_by=p_ator_id
    where id=p_os_id and chamado_id=p_chamado_id and client_id=p_cliente_id and status='solicitacao' and deleted_at is null returning * into v_os;
  if not found then raise exception 'os_indisponivel' using errcode='23514'; end if;
  v_atribuida:=pcm.sso_atribuir_parcela_direta(gen_random_uuid(),p_ator_id,p_cliente_id,p_chamado_id,p_parcela_id,p_os_id,
    (v_criada->>'revision')::bigint,p_escopo_revision,v_os.status,v_os.updated_at,v_motivo);
  if v_atribuida->>'parcelaId' is distinct from p_parcela_id::text or v_atribuida->>'osId' is distinct from p_os_id::text or v_atribuida->'execucaoComprovada' is distinct from 'false'::jsonb then raise exception 'recibo_atribuicao_invalido' using errcode='23514'; end if;
  if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'chamadoId',p_chamado_id,'osId',p_os_id,'parcelaId',p_parcela_id,
    'revision',(v_criada->>'revision')::bigint,'estadoOs',v_os.status,'execucaoComprovada',false,'envioAuvo',false);
  insert into pcm.sso_os_parcela_direta_comandos(request_id,ator_id,cliente_id,chamado_id,parcela_id,os_id,payload,resultado)
    values(p_request_id,p_ator_id,p_cliente_id,p_chamado_id,p_parcela_id,p_os_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'chamado.os_parcela_criada','chamados',p_chamado_id,v_resultado);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_criar_os_parcela_direta(uuid,uuid,uuid,uuid,uuid,uuid,bigint,bigint,text,text,jsonb,text) from public,anon,authenticated,service_role;
