-- ADR-0123: fundação privada, sem webhook, retorno real ou transição de OS.
create table pcm.validacao_os_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
alter table pcm.validacao_os_gate enable row level security;
alter table pcm.validacao_os_gate force row level security;
revoke all on pcm.validacao_os_gate from public, anon, authenticated, service_role;
insert into pcm.validacao_os_gate(id, habilitado) values(true, false);

create table pcm.retorno_os_preparado (
  id uuid primary key, cliente_id uuid not null references pcm.clientes(id),
  os_id uuid not null references pcm.ordens_servico(id),
  versao_id uuid not null references pcm.plano_versoes(id),
  rotina_id uuid not null references pcm.rotinas_manutencao(id),
  chave_evento text not null check(length(btrim(chave_evento)) between 1 and 250),
  origem text not null check(origem in ('auvo_verificado', 'manual_declarado')),
  recebido_em timestamptz not null default now(),
  cobertura_comprovada boolean not null default false,
  unique(origem, chave_evento)
);
create table pcm.respostas_os_preparadas (
  id uuid primary key, retorno_id uuid not null references pcm.retorno_os_preparado(id),
  chave_pergunta text not null check(length(btrim(chave_pergunta)) between 1 and 250),
  resultado text not null check(resultado in ('ok', 'nao_ok', 'nao_aplicavel', 'nao_inspecionado', 'corrigido')),
  obrigatoria boolean not null, observacao text,
  constraint resposta_nao_aplicavel_justificada check (
    resultado <> 'nao_aplicavel' or nullif(btrim(observacao), '') is not null
  ),
  unique(retorno_id, chave_pergunta)
);
create table pcm.decisoes_validacao_os (
  id uuid primary key, retorno_id uuid not null references pcm.retorno_os_preparado(id),
  request_id uuid not null unique, decisao text not null check(decisao in ('aprovar', 'devolver', 'reabrir')),
  motivo text, actor_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table pcm.retorno_os_preparado enable row level security;
alter table pcm.retorno_os_preparado force row level security;
alter table pcm.respostas_os_preparadas enable row level security;
alter table pcm.respostas_os_preparadas force row level security;
alter table pcm.decisoes_validacao_os enable row level security;
alter table pcm.decisoes_validacao_os force row level security;
revoke all on pcm.retorno_os_preparado, pcm.respostas_os_preparadas, pcm.decisoes_validacao_os
  from public, anon, authenticated, service_role;

create function pcm.sso_validar_retorno_os_preparado(
  p_request_id uuid, p_decisao_id uuid, p_retorno_id uuid, p_decisao text, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_retorno pcm.retorno_os_preparado%rowtype;
  v_anterior pcm.decisoes_validacao_os%rowtype; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.validacao_os_gate where id), false) then
    raise exception 'validacao_os_bloqueada' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_decisao_id is null or p_retorno_id is null
    or p_decisao is null or p_decisao not in ('aprovar', 'devolver', 'reabrir')
    or (p_decisao <> 'aprovar' and nullif(btrim(p_motivo), '') is null) then
    raise exception 'decisao_invalida' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('validacao-os-request:' || p_request_id::text, 0));
  select * into v_retorno from pcm.retorno_os_preparado where id = p_retorno_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar', v_retorno.cliente_id) is distinct from true then
    raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_anterior from pcm.decisoes_validacao_os where request_id = p_request_id;
  if found then
    if v_anterior.actor_id is distinct from v_actor or v_anterior.retorno_id <> p_retorno_id
      or v_anterior.id <> p_decisao_id or v_anterior.decisao <> p_decisao
      or v_anterior.motivo is distinct from p_motivo then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return jsonb_build_object('decisaoId', v_anterior.id, 'retornoId', p_retorno_id, 'requestId', p_request_id);
  end if;
  if not exists(select 1 from pcm.ordens_servico o where o.id = v_retorno.os_id
      and o.client_id = v_retorno.cliente_id and o.deleted_at is null)
    or not exists(select 1 from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id = r.versao_id
      join pcm.planos_manutencao p on p.id = r.plano_id
      where r.id = v_retorno.rotina_id and v.id = v_retorno.versao_id and v.estado = 'aprovado'
        and p.cliente_id = v_retorno.cliente_id) then
    raise exception 'vinculo_invalido' using errcode = '23514'; end if;
  if p_decisao = 'aprovar' and (not v_retorno.cobertura_comprovada
    or exists(select 1 from pcm.respostas_os_preparadas r where r.retorno_id = p_retorno_id
      and r.obrigatoria and r.resultado = 'nao_inspecionado')) then
    raise exception 'cobertura_nao_comprovada' using errcode = '23514'; end if;
  insert into pcm.decisoes_validacao_os(id, retorno_id, request_id, decisao, motivo, actor_id)
    values (p_decisao_id, p_retorno_id, p_request_id, p_decisao, p_motivo, v_actor);
  v_resultado := jsonb_build_object('decisaoId', p_decisao_id, 'retornoId', p_retorno_id, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'execucao.decisao_' || p_decisao, 'ordens_servico', v_retorno.os_id, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_validar_retorno_os_preparado(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
