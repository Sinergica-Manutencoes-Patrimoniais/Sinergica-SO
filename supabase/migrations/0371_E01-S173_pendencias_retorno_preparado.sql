-- ADR-0145: fundação privada; não aplicar ou habilitar isoladamente.
create table pcm.sso_pendencias_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_pendencias_gate(id, habilitado) values(true, false);
alter table pcm.sso_pendencias_gate enable row level security;
alter table pcm.sso_pendencias_gate force row level security;
revoke all on pcm.sso_pendencias_gate from public, anon, authenticated, service_role;

create table pcm.sso_pendencias_tecnicas (
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null references pcm.clientes(id),
  resposta_id uuid not null unique references pcm.respostas_os_preparadas(id),
  retorno_id uuid not null references pcm.retorno_os_preparado(id),
  os_id uuid not null references pcm.ordens_servico(id), ocorrencia_id uuid not null references pcm.ocorrencias_preventivas(id),
  rotina_id uuid not null references pcm.rotinas_manutencao(id), alvo_tipo text not null check(alvo_tipo in ('sistema','componente','grupo')),
  alvo_id uuid not null, pergunta text not null, observacao text, estado text not null default 'aberta'
    check(estado in ('aberta','risco_aceito','dispensada','duplicada')),
  revisao integer not null default 1 check(revisao > 0), criado_em timestamptz not null default now()
);
create index sso_pendencias_cliente_alvo on pcm.sso_pendencias_tecnicas(cliente_id, alvo_tipo, alvo_id, id);
create table pcm.sso_pendencias_comandos (
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
create table pcm.sso_pendencias_decisoes (
  id uuid primary key default gen_random_uuid(), pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),
  revisao integer not null, decisao text not null check(decisao in ('risco_aceito','dispensada','duplicada','reaberta')),
  motivo text not null check(length(btrim(motivo)) between 1 and 2000), ator_id uuid not null references auth.users(id),
  request_id uuid not null unique, ocorrido_em timestamptz not null default now(), unique(pendencia_id,revisao)
);
alter table pcm.sso_pendencias_tecnicas enable row level security;
alter table pcm.sso_pendencias_tecnicas force row level security;
alter table pcm.sso_pendencias_comandos enable row level security;
alter table pcm.sso_pendencias_comandos force row level security;
alter table pcm.sso_pendencias_decisoes enable row level security;
alter table pcm.sso_pendencias_decisoes force row level security;
revoke all on pcm.sso_pendencias_tecnicas, pcm.sso_pendencias_comandos, pcm.sso_pendencias_decisoes from public, anon, authenticated, service_role;

create function pcm.sso_registrar_pendencia_retorno(p_request_id uuid, p_resposta_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_resposta pcm.respostas_os_preparadas%rowtype;
  v_retorno pcm.retorno_os_preparado%rowtype; v_rotina pcm.rotinas_manutencao%rowtype;
  v_comando pcm.sso_pendencias_comandos%rowtype; v_ultima text; v_num_decisoes integer; v_ocorrencia uuid; v_id uuid;
  v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_pendencias_gate where id), false) then raise exception 'pendencias_desabilitadas' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_resposta_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload := jsonb_build_object('operacao','registrar','respostaId',p_resposta_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pendencias:' || p_request_id::text,0));
  select * into v_comando from pcm.sso_pendencias_comandos where request_id=p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or config.sso_autorizar_acao('execucao.validar',v_comando.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  select * into v_resposta from pcm.respostas_os_preparadas where id=p_resposta_id;
  if not found then raise exception 'origem_indisponivel' using errcode='23514'; end if;
  select * into v_retorno from pcm.retorno_os_preparado where id=v_resposta.retorno_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',v_retorno.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*), min(d.decisao) into v_num_decisoes, v_ultima from pcm.decisoes_validacao_os d
    where d.retorno_id=v_retorno.id and d.created_at=(select max(x.created_at) from pcm.decisoes_validacao_os x where x.retorno_id=v_retorno.id);
  if v_num_decisoes <> 1 then raise exception 'ordem_decisao_ambigua' using errcode='23514'; end if;
  if v_ultima is distinct from 'aprovar' or v_resposta.resultado <> 'nao_ok' then raise exception 'resultado_nao_elegivel' using errcode='23514'; end if;
  select r.* into v_rotina from pcm.rotinas_manutencao r where r.id=v_retorno.rotina_id and r.versao_id=v_retorno.versao_id;
  select o.ocorrencia_preventiva_id into v_ocorrencia from pcm.ordens_servico o
    join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_legada_id=o.ocorrencia_preventiva_id
    join pcm.ocorrencias_rotina_preparadas oc on oc.id=v.ocorrencia_preparada_id
    where o.id=v_retorno.os_id and o.client_id=v_retorno.cliente_id and o.deleted_at is null
      and oc.rotina_id=v_retorno.rotina_id and oc.versao_id=v_retorno.versao_id;
  if v_ocorrencia is null or v_rotina.id is null then raise exception 'vinculo_invalido' using errcode='23514'; end if;
  insert into pcm.sso_pendencias_tecnicas(cliente_id,resposta_id,retorno_id,os_id,ocorrencia_id,rotina_id,alvo_tipo,alvo_id,pergunta,observacao)
    values(v_retorno.cliente_id,v_resposta.id,v_retorno.id,v_retorno.os_id,v_ocorrencia,v_rotina.id,v_rotina.alvo_tipo,
      coalesce(v_rotina.sistema_id,v_rotina.equipamento_id,v_rotina.grupo_id),v_resposta.chave_pergunta,v_resposta.observacao)
    on conflict(resposta_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from pcm.sso_pendencias_tecnicas where resposta_id=v_resposta.id; end if;
  v_resultado := jsonb_build_object('pendenciaId',v_id,'requestId',p_request_id);
  insert into pcm.sso_pendencias_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_retorno.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'pendencia.registrar','pendencia_tecnica',v_id,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_registrar_pendencia_retorno(uuid,uuid) from public, anon, authenticated, service_role;

create function pcm.sso_decidir_pendencia(p_request_id uuid,p_pendencia_id uuid,p_revision integer,p_decisao text,p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_p pcm.sso_pendencias_tecnicas%rowtype; v_cmd pcm.sso_pendencias_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_estado text;
begin
  if not coalesce((select habilitado from pcm.sso_pendencias_gate where id),false) then raise exception 'pendencias_desabilitadas' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_pendencia_id is null or p_revision is null or p_revision < 1
    or p_decisao is null or p_decisao not in ('risco_aceito','dispensada','duplicada','reaberta')
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload := jsonb_build_object('operacao','decidir','pendenciaId',p_pendencia_id,'revision',p_revision,'decisao',p_decisao,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pendencias:' || p_request_id::text,0));
  select * into v_cmd from pcm.sso_pendencias_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or config.sso_autorizar_acao('execucao.validar',v_cmd.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_p.revisao <> p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if (p_decisao='reaberta' and v_p.estado='aberta') or (p_decisao<>'reaberta' and v_p.estado<>'aberta') then raise exception 'transicao_invalida' using errcode='23514'; end if;
  v_estado := case when p_decisao='reaberta' then 'aberta' else p_decisao end;
  update pcm.sso_pendencias_tecnicas set estado=v_estado,revisao=revisao+1 where id=v_p.id returning * into v_p;
  insert into pcm.sso_pendencias_decisoes(pendencia_id,revisao,decisao,motivo,ator_id,request_id) values(v_p.id,v_p.revisao,p_decisao,btrim(p_motivo),v_ator,p_request_id);
  v_resultado := jsonb_build_object('pendenciaId',v_p.id,'revision',v_p.revisao,'estado',v_p.estado,'requestId',p_request_id);
  insert into pcm.sso_pendencias_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_p.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'pendencia.decisao','pendencia_tecnica',v_p.id,v_resultado || jsonb_build_object('motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_decidir_pendencia(uuid,uuid,integer,text,text) from public, anon, authenticated, service_role;

create function pcm.sso_listar_pendencias_tecnicas(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid, alvo_tipo text, alvo_id uuid, pergunta text, observacao text, estado text, revisao integer, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.alvo_tipo,p.alvo_id,p.pergunta,p.observacao,p.estado,p.revisao,p.criado_em
    from pcm.sso_pendencias_tecnicas p where p.cliente_id=p_cliente_id and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_pendencias_tecnicas(uuid,uuid,integer) from public, anon, authenticated, service_role;
