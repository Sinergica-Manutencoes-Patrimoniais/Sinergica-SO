-- ADR-0209: registra exclusivamente intenção interna, sem alterar OS ou integração.
create table pcm.reprogramacao_os_enviada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.reprogramacao_os_enviada_gate enable row level security;
alter table pcm.reprogramacao_os_enviada_gate force row level security;
revoke all on pcm.reprogramacao_os_enviada_gate from public,anon,authenticated,service_role;
insert into pcm.reprogramacao_os_enviada_gate(id,habilitado) values(true,false);
create table pcm.reprogramacao_os_intencoes (
  id uuid primary key,cliente_id uuid not null references pcm.clientes(id),os_id uuid not null references pcm.ordens_servico(id),
  visita_origem_id uuid not null references pcm.visitas(id),visita_destino_id uuid not null references pcm.visitas(id),
  vinculo_origem_id uuid not null references pcm.visita_ordens_servico(id),
  revisao_origem integer not null check(revisao_origem>0),revisao_destino integer not null check(revisao_destino>0),
  tarefa_auvo_id bigint not null check(tarefa_auvo_id>0),inicio_destino timestamptz not null,fim_destino timestamptz not null,
  motivo text not null check(length(btrim(motivo)) between 1 and 2000),estado text not null default 'pendente' check(estado in ('pendente','descartada','conciliada')),
  request_id uuid not null unique,criado_por uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  check(visita_origem_id<>visita_destino_id),check(fim_destino>inicio_destino)
);
create unique index reprogramacao_os_intencao_pendente_idx on pcm.reprogramacao_os_intencoes(os_id) where estado='pendente';
alter table pcm.reprogramacao_os_intencoes enable row level security;
alter table pcm.reprogramacao_os_intencoes force row level security;
revoke all on pcm.reprogramacao_os_intencoes from public,anon,authenticated,service_role;

create function pcm.sso_propor_reprogramacao_os_enviada(p_request_id uuid,p_intencao_id uuid,p_origem_id uuid,p_destino_id uuid,
  p_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_origem pcm.visitas%rowtype;v_destino pcm.visitas%rowtype;v_vinculo pcm.visita_ordens_servico%rowtype;
  v_os pcm.ordens_servico%rowtype;v_comando pcm.visita_comandos%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.reprogramacao_os_enviada_gate where id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_intencao_id is null or p_origem_id is null or p_destino_id is null or p_origem_id=p_destino_id
    or p_vinculo_id is null or p_revisao_origem is null or p_revisao_origem<1 or p_revisao_destino is null or p_revisao_destino<1
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'intencao_invalida' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('tipo','proporReprogramacaoOsEnviada','intencaoId',p_intencao_id,'origemId',p_origem_id,
    'destinoId',p_destino_id,'vinculoId',p_vinculo_id,'revisaoOrigem',p_revisao_origem,'revisaoDestino',p_revisao_destino,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into v_comando from pcm.visita_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or config.sso_autorizar_acao('visita.confirmar',v_comando.cliente_id) is distinct from true then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  perform id from pcm.visitas where id in (p_origem_id,p_destino_id) order by id for update;
  select * into v_origem from pcm.visitas where id=p_origem_id;
  select * into v_destino from pcm.visitas where id=p_destino_id;
  if v_origem.id is null or v_destino.id is null or v_origem.cliente_id is distinct from v_destino.cliente_id
    or config.sso_autorizar_acao('visita.confirmar',v_origem.cliente_id) is distinct from true then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if v_origem.revisao<>p_revisao_origem or v_destino.revisao<>p_revisao_destino then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_origem.estado not in ('confirmada','enviada','em_execucao','parcial') or v_destino.estado not in ('rascunho','planejada','confirmada') then
    raise exception 'estado_incompativel' using errcode='23514'; end if;
  select * into v_vinculo from pcm.visita_ordens_servico where id=p_vinculo_id and visita_id=p_origem_id
    and cliente_id=v_origem.cliente_id and encerrado_em is null for update;
  if not found then raise exception 'vinculo_nao_disponivel' using errcode='23514'; end if;
  select * into v_os from pcm.ordens_servico where id=v_vinculo.os_id and client_id=v_origem.cliente_id and deleted_at is null for update;
  if not found or v_os.status in ('finalizado','cancelado') or v_os.auvo_task_id is null then raise exception 'tarefa_auvo_nao_identificada' using errcode='23514'; end if;
  if config.sso_autorizar_acao('visita.confirmar',v_origem.cliente_id) is distinct from true then raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  insert into pcm.reprogramacao_os_intencoes(id,cliente_id,os_id,visita_origem_id,visita_destino_id,vinculo_origem_id,
    revisao_origem,revisao_destino,tarefa_auvo_id,inicio_destino,fim_destino,motivo,request_id,criado_por)
    values(p_intencao_id,v_origem.cliente_id,v_os.id,p_origem_id,p_destino_id,p_vinculo_id,
      p_revisao_origem,p_revisao_destino,v_os.auvo_task_id,v_destino.inicio_em,v_destino.fim_em,btrim(p_motivo),p_request_id,v_actor);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'intencaoId',p_intencao_id,'osId',v_os.id,
    'tarefaAuvoId',v_os.auvo_task_id::text,'estado','pendente','efeitoRemoto',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'visita.reprogramacao_os_intencao','ordens_servico',v_os.id,
    v_resultado||jsonb_build_object('clienteId',v_origem.cliente_id,'origemId',p_origem_id,'destinoId',p_destino_id));
  insert into pcm.visita_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_origem.cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_propor_reprogramacao_os_enviada(uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_intencoes_os_enviada(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,visita_origem_id uuid,visita_destino_id uuid,tarefa_auvo_id text,estado text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reprogramacao_os_enviada_gate where id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select i.id,i.os_id,i.visita_origem_id,i.visita_destino_id,i.tarefa_auvo_id::text,i.estado,i.criado_em
    from pcm.reprogramacao_os_intencoes i join pcm.ordens_servico os on os.id=i.os_id and os.client_id=i.cliente_id and os.deleted_at is null
    where i.cliente_id=p_cliente_id and (p_apos is null or i.id>p_apos) order by i.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_intencoes_os_enviada(uuid,uuid,integer) from public,anon,authenticated,service_role;
