-- ADR-1282: união/duplicidade preservam OS; gate fechado.
create table pcm.sso_uniao_chamado_campo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_uniao_chamado_campo_gate(id,habilitado) values(true,false);
create table pcm.sso_unioes_chamado_campo(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  origem_id uuid not null references pcm.chamados(id),destino_id uuid not null references pcm.chamados(id),os_id uuid not null references pcm.ordens_servico(id),
  acao text not null check(acao in ('unir','duplicidade')),motivo text not null,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),
  unique(origem_id),check(origem_id<>destino_id)
);
alter table pcm.sso_uniao_chamado_campo_gate enable row level security;
alter table pcm.sso_uniao_chamado_campo_gate force row level security;
alter table pcm.sso_unioes_chamado_campo enable row level security;
alter table pcm.sso_unioes_chamado_campo force row level security;
revoke all on pcm.sso_uniao_chamado_campo_gate,pcm.sso_unioes_chamado_campo from public,anon,authenticated,service_role;
create trigger sso_unioes_chamado_campo_imutaveis before update or delete on pcm.sso_unioes_chamado_campo for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_listar_destinos_chamado_campo(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid,p_limite integer)
returns table(chamado_id uuid,numero text,titulo text,revisao bigint)
language plpgsql volatile security definer set search_path='' as $$
declare origem uuid;
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_uniao_chamado_campo_gate where id and habilitado for share;
  if not found then raise exception 'uniao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select p.chamado_id into origem from pcm.sso_origem_campo_processamentos p join pcm.ordens_servico o on o.id=p.os_id and o.client_id=p.cliente_id and o.chamado_id=p.chamado_id and o.deleted_at is null where p.os_id=p_os_id and p.cliente_id=p_cliente_id and p.provisorio;
  if origem is null then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  return query select c.id,c.numero,c.titulo,c.sso_revisao from pcm.chamados c where c.cliente_id=p_cliente_id and c.id<>origem and c.deleted_at is null
    and c.status in ('aberto','convertido_os') and c.sso_encerrado_em is null and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_destinos_chamado_campo(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_destinos_chamado_campo(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_unir_chamado_campo(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_os_id uuid,p_origem_id uuid,p_destino_id uuid,
  p_origem_revision bigint,p_destino_revision bigint,p_os_updated_at timestamptz,p_task_id bigint,p_acao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare origem pcm.chamados%rowtype;destino pcm.chamados%rowtype;o pcm.ordens_servico%rowtype;ant pcm.sso_unioes_chamado_campo%rowtype;
  payload jsonb;resultado jsonb;numero_anterior text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_os_id is null or p_origem_id is null or p_destino_id is null
    or p_origem_id=p_destino_id or p_origem_revision is null or p_origem_revision<1 or p_destino_revision is null or p_destino_revision<1
    or p_task_id is null or p_task_id<1 or p_acao not in ('unir','duplicidade') or length(btrim(coalesce(p_motivo,''))) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_uniao_chamado_campo_gate where id and habilitado for share;
  if not found then raise exception 'uniao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'origemId',p_origem_id,'destinoId',p_destino_id,'origemRevision',p_origem_revision,'destinoRevision',p_destino_revision,
    'osUpdatedAt',p_os_updated_at,'taskId',p_task_id::text,'acao',p_acao,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-uniao-campo:'||p_request_id::text,0));
  select * into ant from pcm.sso_unioes_chamado_campo where request_id=p_request_id;
  if found then
    if ant.ator_id is distinct from p_ator_id or ant.cliente_id is distinct from p_cliente_id or ant.payload is distinct from payload then raise exception 'request_conflitante' using errcode='23505'; end if;
    if not exists(select 1 from pcm.ordens_servico x where x.id=ant.os_id and x.client_id=p_cliente_id and x.chamado_id=ant.destino_id and x.deleted_at is null) then raise exception 'os_indisponivel' using errcode='42501'; end if;
    return ant.resultado;
  end if;
  if not exists(select 1 from pcm.sso_origem_campo_processamentos p where p.os_id=p_os_id and p.cliente_id=p_cliente_id and p.chamado_id=p_origem_id and p.provisorio) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  perform c.id from pcm.chamados c where c.id in (p_origem_id,p_destino_id) and c.cliente_id=p_cliente_id and c.deleted_at is null order by c.id for update;
  select * into origem from pcm.chamados where id=p_origem_id and cliente_id=p_cliente_id and deleted_at is null;
  select * into destino from pcm.chamados where id=p_destino_id and cliente_id=p_cliente_id and deleted_at is null;
  if origem.id is null or destino.id is null or origem.status='cancelado' or origem.sso_encerrado_em is not null or destino.status not in ('aberto','convertido_os') or destino.sso_encerrado_em is not null then raise exception 'chamado_indisponivel' using errcode='23514'; end if;
  if origem.sso_revisao<>p_origem_revision or destino.sso_revisao<>p_destino_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and chamado_id=p_origem_id and deleted_at is null for update;
  if not found or o.auvo_task_id is distinct from p_task_id or o.updated_at is distinct from p_os_updated_at then raise exception 'os_alterada' using errcode='40001'; end if;
  if origem.ordem_servico_id is distinct from o.id or exists(select 1 from pcm.ordens_servico x where x.chamado_id=origem.id and x.id<>o.id and x.deleted_at is null)
    or exists(select 1 from pcm.chamado_escopo_composicoes x where x.chamado_id=origem.id) then raise exception 'origem_requer_reconciliacao' using errcode='23514'; end if;
  if pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is not null or exists(select 1 from pg_catalog.pg_trigger where tgrelid='pcm.ordens_servico'::regclass and tgname='trg_ordens_servico_numero_chamado' and not tgisinternal) then raise exception 'transicao_legada_incompleta' using errcode='55000'; end if;
  numero_anterior:=o.numero;
  update pcm.chamados set ordem_servico_id=null,updated_at=now(),updated_by=p_ator_id where id=origem.id returning * into origem;
  update pcm.ordens_servico set chamado_id=destino.id,updated_at=now(),updated_by=p_ator_id where id=o.id returning * into o;
  if o.numero is distinct from numero_anterior or o.auvo_task_id is distinct from p_task_id then raise exception 'identidade_alterada' using errcode='23514'; end if;
  update pcm.chamados set ordem_servico_id=coalesce(ordem_servico_id,o.id),status='convertido_os',updated_at=now(),updated_by=p_ator_id where id=destino.id returning * into destino;
  update pcm.chamados set status='cancelado',cancelamento_justificativa=btrim(p_motivo),updated_at=now(),updated_by=p_ator_id where id=origem.id returning * into origem;
  insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(origem.id,'cancelado',jsonb_build_object('origemCampo',true,'destinoId',destino.id,'osId',o.id,'acao',p_acao,'motivo',btrim(p_motivo)),p_ator_id);
  insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(destino.id,'os_gerada',jsonb_build_object('origemCampo',true,'origemId',origem.id,'ordemServicoId',o.id,'acao',p_acao),p_ator_id);
  resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'origemId',origem.id,'destinoId',destino.id,'osId',o.id,
    'origemRevision',origem.sso_revisao,'destinoRevision',destino.sso_revisao,'acao',p_acao,'numeroOs',o.numero,'taskId',p_task_id::text,'tarefaAlterada',false,'execucaoAlterada',false);
  insert into pcm.sso_unioes_chamado_campo(request_id,ator_id,cliente_id,origem_id,destino_id,os_id,acao,motivo,payload,resultado)
    values(p_request_id,p_ator_id,p_cliente_id,origem.id,destino.id,o.id,p_acao,btrim(p_motivo),payload,resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'origem_campo.chamado_'||p_acao,'chamados',origem.id,resultado||jsonb_build_object('motivo',btrim(p_motivo)));
  return resultado;
end; $$;
revoke all on function pcm.sso_unir_chamado_campo(uuid,uuid,uuid,uuid,uuid,uuid,bigint,bigint,timestamptz,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_unir_chamado_campo(uuid,uuid,uuid,uuid,uuid,uuid,bigint,bigint,timestamptz,bigint,text,text) to authenticated;
