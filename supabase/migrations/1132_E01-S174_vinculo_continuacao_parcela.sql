-- ADR-0981: vínculo declarado, ainda sem divisão ou devolução de escopo.
create table pcm.sso_continuacao_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_continuacao_parcela_gate(id,habilitado) values(true,false);
create table pcm.sso_continuacao_parcela_vinculos(
  request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),ciclo_id uuid not null references pcm.sso_ciclos_backlog(id),
  chamado_id uuid not null references pcm.chamados(id),parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),
  proposta_id uuid not null references pcm.chamado_continuacoes_propostas(id),os_id uuid not null references pcm.ordens_servico(id),
  chamado_revision bigint not null check(chamado_revision>0),proposta_sha256 text not null check(proposta_sha256 ~ '^[a-f0-9]{64}$'),
  ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),
  unique(ciclo_id,proposta_id,proposta_sha256)
);
alter table pcm.sso_continuacao_parcela_gate enable row level security;
alter table pcm.sso_continuacao_parcela_gate force row level security;
alter table pcm.sso_continuacao_parcela_vinculos enable row level security;
alter table pcm.sso_continuacao_parcela_vinculos force row level security;
revoke all on pcm.sso_continuacao_parcela_gate,pcm.sso_continuacao_parcela_vinculos from public,anon,authenticated,service_role;
create trigger sso_continuacao_parcela_vinculos_imutaveis before update or delete on pcm.sso_continuacao_parcela_vinculos
for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_vincular_continuacao_parcela(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,
  p_parcela_id uuid,p_proposta_id uuid,p_chamado_revision bigint,p_proposta_sha256 text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ator uuid:=auth.uid();v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;
  v_parcela pcm.chamado_escopo_parcelas%rowtype;v_proposta pcm.chamado_continuacoes_propostas%rowtype;
  v_ant pcm.sso_continuacao_parcela_vinculos%rowtype;v_payload jsonb;v_resultado jsonb;v_hash text;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_continuacao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_cliente_id is null or p_ciclo_id is null
    or p_parcela_id is null or p_proposta_id is null or p_chamado_revision is null or p_chamado_revision<1
    or p_proposta_sha256 is null or p_proposta_sha256 !~ '^[a-f0-9]{64}$' or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'cicloId',p_ciclo_id,'parcelaId',p_parcela_id,'propostaId',p_proposta_id,
    'chamadoRevision',p_chamado_revision,'propostaSha256',p_proposta_sha256,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('continuacao-parcela:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_continuacao_parcela_vinculos where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id;
  if not found then raise exception 'ciclo_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_chamado.sso_revisao is distinct from p_chamado_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and parcela_id=p_parcela_id and chamado_id=v_chamado.id for update;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado.id for update;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=p_proposta_id and chamado_id=v_chamado.id for update;
  if v_ciclo.id is null or v_ciclo.estado<>'em_tratamento' or v_parcela.id is null or v_parcela.situacao<>'pendente'
    or v_proposta.id is null or v_proposta.situacao<>'pendente' or v_proposta.os_continuacao_id is not null then raise exception 'escopo_ou_proposta_indisponivel' using errcode='23514'; end if;
  perform 1 from pcm.ordens_servico o join pcm.sso_atribuicoes_parcela a on a.os_id=o.id and a.parcela_id=p_parcela_id and a.chamado_id=o.chamado_id and a.cliente_id=o.client_id
    where o.id=v_proposta.os_anterior_id and o.chamado_id=v_chamado.id and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' for share of o,a;
  if not found then raise exception 'os_ou_atribuicao_indisponivel' using errcode='23514'; end if;
  v_hash:=encode(sha256(convert_to(to_jsonb(v_proposta)::text,'UTF8')),'hex');
  if v_hash is distinct from p_proposta_sha256 then raise exception 'proposta_alterada' using errcode='40001'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'cicloId',p_ciclo_id,'parcelaId',p_parcela_id,
    'propostaId',p_proposta_id,'osId',v_proposta.os_anterior_id,'propostaSha256',v_hash,'vinculoDeclarado',true,'restanteComprovado',false,'devolucaoAutorizada',false);
  insert into pcm.sso_continuacao_parcela_vinculos(request_id,cliente_id,ciclo_id,chamado_id,parcela_id,proposta_id,os_id,chamado_revision,proposta_sha256,ator_id,payload,resultado)
    values(p_request_id,p_cliente_id,p_ciclo_id,v_chamado.id,p_parcela_id,p_proposta_id,v_proposta.os_anterior_id,p_chamado_revision,v_hash,v_ator,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.continuacao_parcela_vinculada','chamados',v_chamado.id,v_resultado||jsonb_build_object('motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_vincular_continuacao_parcela(uuid,uuid,uuid,uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated,service_role;
