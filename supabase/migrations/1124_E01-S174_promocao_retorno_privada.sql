-- ADR-0973: caminho privado e fechado; não cria OS nem tarefa externa.
create table pcm.sso_promocao_retorno_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_promocao_retorno_gate(id,habilitado) values(true,false);
create table pcm.sso_promocoes_retorno(
  request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),retorno_id uuid not null unique references pcm.sso_retornos_ciclo_backlog(id),
  chamado_id uuid not null unique references pcm.chamados(id),parcela_id uuid not null unique references pcm.chamado_escopo_parcelas(id),
  ciclo_id uuid not null unique references pcm.sso_ciclos_backlog(id),ator_id uuid not null references auth.users(id),
  payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_promocao_retorno_gate enable row level security;
alter table pcm.sso_promocao_retorno_gate force row level security;
alter table pcm.sso_promocoes_retorno enable row level security;
alter table pcm.sso_promocoes_retorno force row level security;
revoke all on pcm.sso_promocao_retorno_gate,pcm.sso_promocoes_retorno from public,anon,authenticated,service_role;
create trigger sso_promocoes_retorno_imutaveis before update or delete on pcm.sso_promocoes_retorno
for each row execute function pcm.sso_proteger_conferencia_levantamento();
alter table pcm.sso_ciclos_backlog_eventos drop constraint sso_ciclos_backlog_eventos_tipo_check;
alter table pcm.sso_ciclos_backlog_eventos add constraint sso_ciclos_backlog_eventos_tipo_check
  check(tipo in ('legado_inicializado','devolvido','concluido','promovido_retorno'));

create function pcm.sso_promover_retorno_ciclo(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_retorno_id uuid,
  p_retorno_revision integer,p_chamado_id uuid,p_parcela_id uuid,p_ciclo_id uuid,p_titulo text,p_descricao text)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_promocoes_retorno%rowtype;v_retorno pcm.sso_retornos_ciclo_backlog%rowtype;
  v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_os pcm.ordens_servico%rowtype;v_suspensao pcm.sso_suspensoes_chamado%rowtype;v_interrupcao pcm.sso_interrupcoes_parcela%rowtype;
  v_reconciliacao pcm.sso_reconciliacoes_parcela%rowtype;v_payload jsonb;v_resultado jsonb;
  v_titulo text:=nullif(btrim(p_titulo),'');v_numero text;v_rev bigint;v_descricao_parcela text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_promocao_retorno_gate where id and habilitado for share;
  if not found then raise exception 'promocao_retorno_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_retorno_ciclo_gate where id and habilitado for share;
  if not found then raise exception 'retorno_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.chamado_os_gate where id and habilitado for share;
  if not found then raise exception 'chamado_desabilitado' using errcode='55000'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_cliente_id is null or p_retorno_id is null
    or p_retorno_revision is null or p_retorno_revision<1 or p_chamado_id is null or p_parcela_id is null or p_ciclo_id is null
    or v_titulo is null or length(v_titulo)>200 or length(coalesce(p_descricao,''))>10000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('backlog.promover',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'retornoRevision',p_retorno_revision,
    'chamadoId',p_chamado_id,'parcelaId',p_parcela_id,'cicloId',p_ciclo_id,'titulo',v_titulo,'descricao',p_descricao);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('promocao-retorno:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_promocoes_retorno where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  select * into v_retorno from pcm.sso_retornos_ciclo_backlog where id=p_retorno_id and cliente_id=p_cliente_id;
  if not found then raise exception 'retorno_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_retorno.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_retorno from pcm.sso_retornos_ciclo_backlog where id=p_retorno_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id for update;
  if v_retorno.id is null or v_retorno.estado<>'aguardando' or v_retorno.revisao<>p_retorno_revision then raise exception 'retorno_alterado' using errcode='40001'; end if;
  select * into v_suspensao from pcm.sso_suspensoes_chamado where chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=v_retorno.ciclo_id and cliente_id=p_cliente_id for update;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=v_retorno.parcela_id and chamado_id=v_chamado.id for update;
  select * into v_os from pcm.ordens_servico where id=v_retorno.os_id and chamado_id=v_chamado.id and client_id=p_cliente_id and deleted_at is null for update;
  select * into v_interrupcao from pcm.sso_interrupcoes_parcela where parcela_id=v_retorno.parcela_id and os_id=v_retorno.os_id and chamado_id=v_chamado.id and cliente_id=p_cliente_id for update;
  select * into v_reconciliacao from pcm.sso_reconciliacoes_parcela where parcela_id=v_retorno.parcela_id and cliente_id=p_cliente_id order by revisao desc limit 1;
  if v_ciclo.id is null or v_ciclo.estado<>'devolvido' or v_ciclo.pendencia_id is distinct from v_retorno.pendencia_id
    or v_ciclo.parcela_id is distinct from v_parcela.id or v_parcela.situacao is distinct from 'pendente'
    or v_os.id is null or v_os.status not in ('finalizado','cancelado') or v_os.status is null
    or v_suspensao.estado is distinct from 'suspenso' or v_suspensao.revisao is distinct from v_retorno.suspensao_revision
    or v_interrupcao.estado is distinct from 'declarada' or v_interrupcao.revisao is distinct from v_retorno.interrupcao_revision
    or v_reconciliacao.id is distinct from v_retorno.reconciliacao_id or v_reconciliacao.parcela_id is distinct from v_parcela.id or v_reconciliacao.os_id is distinct from v_os.id
    or v_reconciliacao.suspensao_revision is distinct from v_retorno.suspensao_revision or v_reconciliacao.interrupcao_revision is distinct from v_retorno.interrupcao_revision
    or v_reconciliacao.estado is distinct from 'nao_executada_declarada' then raise exception 'origem_incompativel' using errcode='23514'; end if;
  perform 1 from pcm.sso_pendencias_tecnicas where id=v_retorno.pendencia_id and cliente_id=p_cliente_id and estado='aberta' for update;
  if not found or exists(select 1 from pcm.sso_ciclos_backlog where pendencia_id=v_retorno.pendencia_id and estado='em_tratamento') then
    raise exception 'pendencia_indisponivel_ou_em_tratamento' using errcode='23514'; end if;
  if config.sso_autorizar_acao('backlog.promover',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_descricao_parcela:=pcm.sso_descricao_historica_pendencia(p_cliente_id,v_retorno.pendencia_id);
  v_numero:=pcm.fn_proximo_numero_chamado();
  insert into pcm.chamados(id,numero,cliente_id,titulo,descricao,origem,status,created_by,updated_by)
    values(p_chamado_id,v_numero,p_cliente_id,v_titulo,p_descricao,'manual','aberto',v_ator,v_ator);
  insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by)
    values(p_chamado_id,'criado',jsonb_build_object('requestId',p_request_id,'origemRetorno',p_retorno_id),v_ator);
  select sso_revisao into v_rev from pcm.chamados where id=p_chamado_id;
  perform pcm.sso_comando_escopo_chamado(gen_random_uuid(),p_cliente_id,p_chamado_id,v_rev,'adicionar_parcela',p_parcela_id,v_descricao_parcela,null,null);
  insert into pcm.sso_ciclos_backlog(id,pendencia_id,cliente_id,composicao_id,chamado_id,parcela_id,estado)
    values(p_ciclo_id,v_retorno.pendencia_id,p_cliente_id,v_ciclo.composicao_id,p_chamado_id,p_parcela_id,'em_tratamento');
  update pcm.sso_retornos_ciclo_backlog set estado='promovido',revisao=revisao+1 where id=p_retorno_id;
  insert into pcm.sso_ciclos_backlog_eventos(ciclo_id,revisao,tipo,ator_id,request_id,payload)
    values(p_ciclo_id,1,'promovido_retorno',v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'retornoId',p_retorno_id,'retornoRevision',p_retorno_revision+1,
    'pendenciaId',v_retorno.pendencia_id,'chamadoAnteriorId',v_chamado.id,'parcelaAnteriorId',v_parcela.id,'cicloAnteriorId',v_ciclo.id,
    'chamadoId',p_chamado_id,'numero',v_numero,'parcelaId',p_parcela_id,'cicloId',p_ciclo_id,'osCriada',false,'tarefaCriada',false);
  insert into pcm.sso_promocoes_retorno(request_id,cliente_id,retorno_id,chamado_id,parcela_id,ciclo_id,ator_id,payload,resultado)
    values(p_request_id,p_cliente_id,p_retorno_id,p_chamado_id,p_parcela_id,p_ciclo_id,v_ator,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.retorno_promovido','sso_retornos_ciclo_backlog',p_retorno_id,v_resultado);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_promover_retorno_ciclo(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
