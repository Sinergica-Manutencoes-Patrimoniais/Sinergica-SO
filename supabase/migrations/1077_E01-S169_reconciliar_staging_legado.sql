-- ADR-0893. Preparação aditiva; não executar transporte sem revisão e liberação.
create table pcm.sso_reconciliacao_cronograma_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_reconciliacao_cronograma_gate(id,habilitado) values(true,false);
alter table pcm.sso_reconciliacao_cronograma_gate enable row level security;
alter table pcm.sso_reconciliacao_cronograma_gate force row level security;
revoke all on pcm.sso_reconciliacao_cronograma_gate from public,anon,authenticated,service_role;

create table pcm.sso_reconciliacoes_cronograma (
  request_id uuid primary key,
  lote_id uuid not null unique references pcm.cronograma_importacao_lotes(id),
  cliente_id uuid not null references pcm.clientes(id),
  ator_id uuid not null references config.usuarios(user_id),
  revisao integer not null check (revisao > 0),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table pcm.sso_reconciliacoes_cronograma enable row level security;
alter table pcm.sso_reconciliacoes_cronograma force row level security;
revoke all on pcm.sso_reconciliacoes_cronograma from public,anon,authenticated,service_role;

create function pcm.sso_reconciliar_cronograma_legado(
  p_request_id uuid,p_lote_id uuid,p_cliente_id uuid,p_revisao integer,p_motivo text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid(); v_lote pcm.cronograma_importacao_lotes%rowtype;
  v_replay pcm.sso_reconciliacoes_cronograma%rowtype;
  v_comando record; v_linha jsonb; v_celula jsonb; v_resultado jsonb; v_motivo text:=btrim(p_motivo);
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_reconciliacao_cronograma_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_reconciliacao_cronograma_gate g where g.id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_cliente_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if p_request_id is null or p_lote_id is null or p_revisao is null or p_revisao < 1 or v_motivo is null or length(v_motivo) not between 1 and 2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_replay from pcm.sso_reconciliacoes_cronograma where request_id=p_request_id;
  if found then
    if v_replay.ator_id is distinct from v_actor or v_replay.lote_id is distinct from p_lote_id or v_replay.cliente_id is distinct from p_cliente_id
      or v_replay.revisao is distinct from p_revisao or v_replay.motivo is distinct from v_motivo then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_replay.resultado;
  end if;
  -- Exclusão de escritores privilegiados durante verificação e transporte; falha sem espera.
  lock table pcm.cronograma_importacao_lotes,pcm.cronograma_importacao_revisoes,pcm.cronograma_importacao_comandos in share mode nowait;
  select * into v_lote from pcm.cronograma_importacao_lotes where id=p_lote_id and cliente_id=p_cliente_id;
  if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if v_lote.revisao <> p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_lote.fonte_id <> btrim(v_lote.fonte_id) or length(v_lote.fonte_id) not between 1 and 188
    or jsonb_typeof(v_lote.matriz) is distinct from 'array' or octet_length(v_lote.matriz::text)>1048576 then raise exception 'origem_incompativel' using errcode='23514'; end if;
  if jsonb_array_length(v_lote.matriz) not between 5 and 10000 then raise exception 'origem_incompativel' using errcode='23514'; end if;
  for v_linha in select value from jsonb_array_elements(v_lote.matriz) loop
    if jsonb_typeof(v_linha) is distinct from 'array' then raise exception 'origem_incompativel' using errcode='23514'; end if;
    if jsonb_array_length(v_linha)>500 then raise exception 'origem_incompativel' using errcode='23514'; end if;
    for v_celula in select value from jsonb_array_elements(v_linha) loop
      if jsonb_typeof(v_celula) not in ('string','number','boolean','null') or octet_length(v_celula::text)>4000 then raise exception 'origem_incompativel' using errcode='23514'; end if;
    end loop;
  end loop;
  if not exists(select 1 from config.usuarios where user_id=v_lote.criado_por) or not exists(select 1 from config.usuarios where user_id=v_actor)
    or (select count(*) from pcm.cronograma_importacao_revisoes where lote_id=p_lote_id) <> p_revisao-1
    or exists(select 1 from pcm.cronograma_importacao_revisoes r where r.lote_id=p_lote_id and
       (r.revisao>p_revisao or r.numero_linha>jsonb_array_length(v_lote.matriz) or not exists(select 1 from config.usuarios u where u.user_id=r.ator_id)
        or exists(select 1 from pcm.sso_levantamento_conferencias c where c.id=r.id))) then raise exception 'historico_incompativel' using errcode='23514'; end if;
  if not exists(select 1 from pcm.cronograma_importacao_comandos c where c.payload->>'loteId'=p_lote_id::text and c.payload->>'tipo'='receber')
    or exists(select 1 from pcm.cronograma_importacao_comandos c where (c.payload->>'loteId'=p_lote_id::text or c.resultado->>'aggregateId'=p_lote_id::text)
      and (c.cliente_id is distinct from p_cliente_id or c.payload->>'loteId' is distinct from p_lote_id::text or c.resultado->>'aggregateId' is distinct from p_lote_id::text
        or c.payload->>'tipo' not in ('receber','anotar') or c.payload->>'tipo' is null or not exists(select 1 from config.usuarios u where u.user_id=c.ator_id))) then raise exception 'comandos_incompativeis' using errcode='23514'; end if;
  if exists(select 1 from pcm.cronograma_importacao_comandos where request_id=p_request_id)
    or exists(select 1 from pcm.sso_levantamento_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  for v_comando in select c.request_id from pcm.cronograma_importacao_comandos c where c.payload->>'loteId'=p_lote_id::text order by c.request_id loop
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_comando.request_id::text,0)) then raise exception 'comando_em_uso' using errcode='55P03'; end if;
    if exists(select 1 from pcm.sso_levantamento_comandos where request_id=v_comando.request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array(p_cliente_id,'planilha','cronograma:'||v_lote.fonte_id)::text,0));
  if exists(select 1 from pcm.sso_levantamentos where id=p_lote_id or (cliente_id=p_cliente_id and origem='planilha' and chave_origem='cronograma:'||v_lote.fonte_id)) then raise exception 'origem_conflitante' using errcode='23505'; end if;
  insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,revisao,criado_por,criado_em)
    values(v_lote.id,v_lote.cliente_id,'planilha','cronograma:'||v_lote.fonte_id,v_lote.matriz,v_lote.revisao,v_lote.criado_por,v_lote.criado_em);
  insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos)
    select p_lote_id,ord::text,'cronograma',jsonb_build_object('celulas',item) from jsonb_array_elements(v_lote.matriz) with ordinality as x(item,ord);
  insert into pcm.sso_levantamento_conferencias(id,lote_id,chave_linha,revisao_lote,observacao,ator_id,criado_em)
    select id,lote_id,numero_linha::text,revisao,observacao,ator_id,criado_em from pcm.cronograma_importacao_revisoes where lote_id=p_lote_id;
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado,criado_em)
    select request_id,ator_id,payload,resultado,criado_em from pcm.cronograma_importacao_comandos where payload->>'loteId'=p_lote_id::text;
  v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',p_revisao,'state','pendente','requestId',p_request_id);
  insert into pcm.sso_reconciliacoes_cronograma(request_id,lote_id,cliente_id,ator_id,revisao,motivo,resultado)
    values(p_request_id,p_lote_id,p_cliente_id,v_actor,p_revisao,v_motivo,v_resultado);
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado)
    values(p_request_id,v_actor,jsonb_build_object('tipo','reconciliarCronogramaLegado','loteId',p_lote_id,'clienteId',p_cliente_id,'revision',p_revisao,'motivo',v_motivo),v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.legado_reconciliado','sso_levantamentos',p_lote_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revision',p_revisao,'motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_reconciliar_cronograma_legado(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliar_cronograma_legado(uuid,uuid,uuid,integer,text) to authenticated;
