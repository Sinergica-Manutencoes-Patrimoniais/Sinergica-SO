-- ADR-0982: retorno parcial privado; não promove, não altera OS ou proposta.
create table pcm.sso_retorno_parcial_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_retorno_parcial_gate(id,habilitado) values(true,false);
create table pcm.sso_retornos_parciais(
  id uuid primary key,ciclo_id uuid not null unique references pcm.sso_ciclos_backlog(id),cliente_id uuid not null references pcm.clientes(id),
  pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),chamado_id uuid not null references pcm.chamados(id),
  parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),os_id uuid not null references pcm.ordens_servico(id),
  proposta_id uuid not null references pcm.chamado_continuacoes_propostas(id),vinculo_request_id uuid not null references pcm.sso_continuacao_parcela_vinculos(request_id),
  revisao_humana integer not null check(revisao_humana>0),suspensao_revision integer not null check(suspensao_revision>0),
  interrupcao_revision integer not null check(interrupcao_revision>0),proposta_sha256 text not null check(proposta_sha256 ~ '^[a-f0-9]{64}$'),
  descricao_restante text not null check(length(btrim(descricao_restante)) between 1 and 4000),minutos_restantes integer not null check(minutos_restantes>0),
  estado text not null check(estado in ('aguardando','promovido')),revisao integer not null default 1 check(revisao>0),criado_em timestamptz not null default now()
);
create unique index sso_retornos_parciais_um_aguardando on pcm.sso_retornos_parciais(pendencia_id) where estado='aguardando';
create table pcm.sso_comandos_retorno_parcial(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  retorno_id uuid not null unique references pcm.sso_retornos_parciais(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_retorno_parcial_gate enable row level security;alter table pcm.sso_retorno_parcial_gate force row level security;
alter table pcm.sso_retornos_parciais enable row level security;alter table pcm.sso_retornos_parciais force row level security;
alter table pcm.sso_comandos_retorno_parcial enable row level security;alter table pcm.sso_comandos_retorno_parcial force row level security;
revoke all on pcm.sso_retorno_parcial_gate,pcm.sso_retornos_parciais,pcm.sso_comandos_retorno_parcial from public,anon,authenticated,service_role;
create trigger sso_comandos_retorno_parcial_imutaveis before update or delete on pcm.sso_comandos_retorno_parcial
for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_devolver_continuacao_parcial(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,p_retorno_id uuid,
  p_ciclo_revision integer,p_suspensao_revision integer,p_interrupcao_revision integer,p_revisao_humana integer,
  p_vinculo_request_id uuid,p_proposta_sha256 text,p_motivo text) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_comandos_retorno_parcial%rowtype;v_ciclo pcm.sso_ciclos_backlog%rowtype;
  v_chamado pcm.chamados%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;v_os pcm.ordens_servico%rowtype;
  v_suspensao pcm.sso_suspensoes_chamado%rowtype;v_interrupcao pcm.sso_interrupcoes_parcela%rowtype;
  v_vinculo pcm.sso_continuacao_parcela_vinculos%rowtype;v_proposta pcm.chamado_continuacoes_propostas%rowtype;
  v_revisao pcm.sso_revisoes_parcela%rowtype;v_hash text;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_retorno_parcial_gate where id and habilitado for share;
  if not found then raise exception 'retorno_parcial_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.sso_continuacao_parcela_gate where id and habilitado for share;
  if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_cliente_id is null or p_ciclo_id is null or p_retorno_id is null
    or p_ciclo_revision is null or p_ciclo_revision<1 or p_suspensao_revision is null or p_suspensao_revision<1
    or p_interrupcao_revision is null or p_interrupcao_revision<1 or p_revisao_humana is null or p_revisao_humana<1
    or p_vinculo_request_id is null or p_proposta_sha256 is null or p_proposta_sha256 !~ '^[a-f0-9]{64}$'
    or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'cicloId',p_ciclo_id,'retornoId',p_retorno_id,'cicloRevision',p_ciclo_revision,
    'suspensaoRevision',p_suspensao_revision,'interrupcaoRevision',p_interrupcao_revision,'revisaoHumana',p_revisao_humana,
    'vinculoRequestId',p_vinculo_request_id,'propostaSha256',p_proposta_sha256,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('retorno-parcial:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_comandos_retorno_parcial where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id;
  if not found then raise exception 'ciclo_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_suspensao from pcm.sso_suspensoes_chamado where chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id for update;
  if v_ciclo.id is null or v_ciclo.estado<>'em_tratamento' or v_ciclo.revisao is distinct from p_ciclo_revision
    or v_suspensao.estado is distinct from 'suspenso' or v_suspensao.revisao is distinct from p_suspensao_revision then raise exception 'ciclo_ou_suspensao_alterada' using errcode='40001'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=v_ciclo.parcela_id and chamado_id=v_chamado.id for update;
  select * into v_vinculo from pcm.sso_continuacao_parcela_vinculos where request_id=p_vinculo_request_id and cliente_id=p_cliente_id and ciclo_id=p_ciclo_id and parcela_id=v_ciclo.parcela_id;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=v_vinculo.proposta_id and chamado_id=v_chamado.id for update;
  select * into v_os from pcm.ordens_servico where id=v_vinculo.os_id and chamado_id=v_chamado.id and client_id=p_cliente_id and deleted_at is null for update;
  select * into v_interrupcao from pcm.sso_interrupcoes_parcela where parcela_id=v_ciclo.parcela_id and os_id=v_os.id and chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  select * into v_revisao from pcm.sso_revisoes_parcela where parcela_id=v_ciclo.parcela_id and cliente_id=p_cliente_id order by revisao desc limit 1;
  if v_parcela.id is null or v_parcela.situacao<>'pendente' or v_vinculo.request_id is null or v_proposta.id is null
    or v_proposta.situacao<>'pendente' or v_proposta.os_continuacao_id is not null or v_proposta.os_anterior_id is distinct from v_os.id
    or v_os.id is null or v_os.status is distinct from 'finalizado' or v_interrupcao.estado is distinct from 'declarada'
    or v_interrupcao.revisao is distinct from p_interrupcao_revision or v_revisao.revisao is distinct from p_revisao_humana
    or v_revisao.os_id is distinct from v_os.id or v_revisao.atendida is distinct from false then raise exception 'proposta_ou_revisao_indisponivel' using errcode='23514'; end if;
  if not exists(select 1 from pcm.sso_atribuicoes_parcela a where a.parcela_id=v_parcela.id and a.os_id=v_os.id and a.chamado_id=v_chamado.id and a.cliente_id=p_cliente_id) then raise exception 'atribuicao_indisponivel' using errcode='23514'; end if;
  v_hash:=encode(sha256(convert_to(to_jsonb(v_proposta)::text,'UTF8')),'hex');
  if v_hash is distinct from p_proposta_sha256 or v_vinculo.proposta_sha256 is distinct from v_hash then raise exception 'proposta_alterada' using errcode='40001'; end if;
  perform 1 from pcm.sso_pendencias_tecnicas where id=v_ciclo.pendencia_id and cliente_id=p_cliente_id and estado='aberta' for update;
  if not found or exists(select 1 from pcm.sso_retornos_ciclo_backlog where pendencia_id=v_ciclo.pendencia_id and estado='aguardando')
    or exists(select 1 from pcm.sso_retornos_parciais where pendencia_id=v_ciclo.pendencia_id and estado='aguardando') then raise exception 'pendencia_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  update pcm.sso_ciclos_backlog set estado='devolvido',revisao=revisao+1 where id=p_ciclo_id;
  insert into pcm.sso_retornos_parciais(id,ciclo_id,cliente_id,pendencia_id,chamado_id,parcela_id,os_id,proposta_id,vinculo_request_id,revisao_humana,
    suspensao_revision,interrupcao_revision,proposta_sha256,descricao_restante,minutos_restantes,estado)
    values(p_retorno_id,p_ciclo_id,p_cliente_id,v_ciclo.pendencia_id,v_chamado.id,v_parcela.id,v_os.id,v_proposta.id,p_vinculo_request_id,p_revisao_humana,
      p_suspensao_revision,p_interrupcao_revision,v_hash,v_proposta.descricao_restante,v_proposta.minutos_restantes,'aguardando');
  insert into pcm.sso_ciclos_backlog_eventos(ciclo_id,revisao,tipo,ator_id,request_id,payload) values(p_ciclo_id,p_ciclo_revision+1,'devolvido',v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'cicloId',p_ciclo_id,'retornoId',p_retorno_id,
    'revision',p_ciclo_revision+1,'estado','aguardando','tipo','parcial','descricaoRestante',v_proposta.descricao_restante,
    'minutosRestantes',v_proposta.minutos_restantes,'paradaComprovada',false,'promovido',false);
  insert into pcm.sso_comandos_retorno_parcial(request_id,ator_id,cliente_id,retorno_id,payload,resultado) values(p_request_id,v_ator,p_cliente_id,p_retorno_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.continuacao_devolvida','sso_ciclos_backlog',p_ciclo_id,v_resultado||jsonb_build_object('motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_devolver_continuacao_parcial(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,integer,uuid,text,text) from public,anon,authenticated,service_role;
