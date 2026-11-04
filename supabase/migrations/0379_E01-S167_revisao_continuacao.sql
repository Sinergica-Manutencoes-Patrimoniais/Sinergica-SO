-- ADR-0153: revisão PCM com histórico, sem criação de OS.
create table pcm.chamado_continuacoes_revisoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references pcm.chamado_continuacoes_propostas(id),
  chamado_id uuid not null references pcm.chamados(id),
  revisao_chamado bigint not null check (revisao_chamado > 1),
  descricao_anterior text not null, minutos_anteriores integer not null,
  descricao_nova text not null, minutos_novos integer not null,
  ator_id uuid not null references auth.users(id), criado_em timestamptz not null default now(),
  unique(chamado_id,revisao_chamado)
);
create index chamado_continuacoes_revisoes_proposta_idx on pcm.chamado_continuacoes_revisoes(proposta_id,revisao_chamado);
alter table pcm.chamado_continuacoes_revisoes enable row level security;
alter table pcm.chamado_continuacoes_revisoes force row level security;
revoke all on pcm.chamado_continuacoes_revisoes from public,anon,authenticated,service_role;
create function pcm.sso_proteger_revisao_continuacao() returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'revisao_continuacao_imutavel' using errcode='23514';
end;
$$;
revoke all on function pcm.sso_proteger_revisao_continuacao() from public,anon,authenticated,service_role;
create trigger chamado_continuacoes_revisoes_imutavel before update or delete on pcm.chamado_continuacoes_revisoes
  for each row execute function pcm.sso_proteger_revisao_continuacao();

create function pcm.sso_revisar_continuacao_chamado(p_request_id uuid,p_cliente_id uuid,p_chamado_id uuid,
  p_expected_revision bigint,p_proposta_id uuid,p_descricao text,p_minutos integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_chamado pcm.chamados%rowtype;
  v_proposta pcm.chamado_continuacoes_propostas%rowtype; v_comando pcm.chamado_os_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) then
    raise exception 'comando_bloqueado' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null
    or p_expected_revision is null or p_expected_revision<1 or p_proposta_id is null
    or p_descricao is null or length(btrim(p_descricao)) not between 1 and 4000
    or p_minutos is null or p_minutos<1 then raise exception 'revisao_invalida' using errcode='22023'; end if;
  v_payload := jsonb_build_object('acao','revisar_continuacao','clienteId',p_cliente_id,'chamadoId',p_chamado_id,
    'expectedRevision',p_expected_revision,'propostaId',p_proposta_id,'descricao',btrim(p_descricao),'minutos',p_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:' || p_request_id::text,0));
  select * into v_comando from pcm.chamado_os_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or config.sso_autorizar_acao('execucao.validar',v_comando.cliente_id) is distinct from true then
      raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  select * into v_chamado from pcm.chamados where id=p_chamado_id for update;
  if not found or v_chamado.cliente_id is distinct from p_cliente_id or v_chamado.deleted_at is not null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if v_chamado.sso_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_chamado.sso_encerrado_em is not null or v_chamado.status='cancelado' then
    raise exception 'chamado_nao_editavel' using errcode='23514'; end if;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=p_proposta_id and chamado_id=p_chamado_id for update;
  if not found or v_proposta.situacao<>'pendente' then raise exception 'proposta_nao_disponivel' using errcode='23514'; end if;
  perform 1 from pcm.ordens_servico where id=v_proposta.os_anterior_id and chamado_id=p_chamado_id
    and client_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'os_invalida' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  update pcm.chamado_continuacoes_propostas set descricao_restante=btrim(p_descricao),minutos_restantes=p_minutos where id=p_proposta_id;
  update pcm.chamados set updated_at=now(),updated_by=v_actor where id=p_chamado_id returning * into v_chamado;
  insert into pcm.chamado_continuacoes_revisoes(proposta_id,chamado_id,revisao_chamado,descricao_anterior,minutos_anteriores,
    descricao_nova,minutos_novos,ator_id) values(p_proposta_id,p_chamado_id,v_chamado.sso_revisao,
    v_proposta.descricao_restante,v_proposta.minutos_restantes,btrim(p_descricao),p_minutos,v_actor);
  v_resultado := jsonb_build_object('requestId',p_request_id,'propostaId',p_proposta_id,'revision',v_chamado.sso_revisao);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'chamado.continuacao_revisada','chamados',p_chamado_id,v_resultado);
  insert into pcm.chamado_os_comandos(request_id,actor_id,cliente_id,chamado_id,payload,resultado)
    values(p_request_id,v_actor,p_cliente_id,p_chamado_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_revisar_continuacao_chamado(uuid,uuid,uuid,bigint,uuid,text,integer) from public,anon,authenticated,service_role;
