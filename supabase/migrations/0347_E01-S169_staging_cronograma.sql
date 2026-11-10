-- ADR-0122: staging de matriz tipada; não escreve em Plano/Rotina nem faz aprovação.
-- SPEC_DEVIATION: staging separado conflita com T003 da E01-S169, que exige reusar
-- E01-S178 sem tabela concorrente. Não aplicar ou ativar até reconciliar arquitetura.
create table pcm.cronograma_importacao_lotes (
 id uuid primary key, cliente_id uuid not null references pcm.clientes(id),
 fonte_id text not null check (length(btrim(fonte_id)) between 1 and 200),
 matriz jsonb not null check (jsonb_typeof(matriz) = 'array' and octet_length(matriz::text) <= 1048576),
 revisao integer not null default 1 check (revisao > 0),
 criado_por uuid not null references auth.users(id), criado_em timestamptz not null default now(),
 unique (cliente_id, fonte_id)
);
create table pcm.cronograma_importacao_revisoes (
 id uuid primary key default gen_random_uuid(), lote_id uuid not null references pcm.cronograma_importacao_lotes(id),
 revisao integer not null check (revisao > 1), numero_linha integer not null check (numero_linha > 0),
 observacao text not null check (length(btrim(observacao)) between 1 and 2000),
 ator_id uuid not null references auth.users(id), criado_em timestamptz not null default now(), unique(lote_id,revisao)
);
create table pcm.cronograma_importacao_comandos (
 request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
 payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.cronograma_importacao_lotes enable row level security;
alter table pcm.cronograma_importacao_lotes force row level security;
alter table pcm.cronograma_importacao_revisoes enable row level security;
alter table pcm.cronograma_importacao_revisoes force row level security;
alter table pcm.cronograma_importacao_comandos enable row level security;
alter table pcm.cronograma_importacao_comandos force row level security;
revoke all on pcm.cronograma_importacao_lotes, pcm.cronograma_importacao_revisoes, pcm.cronograma_importacao_comandos from public, anon, authenticated, service_role;

create function pcm.sso_receber_matriz_cronograma(p_request_id uuid, p_lote_id uuid, p_cliente_id uuid, p_fonte_id text, p_matriz jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_lote pcm.cronograma_importacao_lotes%rowtype; v_comando pcm.cronograma_importacao_comandos%rowtype;
 v_linha jsonb; v_valor jsonb; v_payload jsonb; v_resultado jsonb; v_criado boolean := false;
begin
 if v_actor is null or p_request_id is null or p_lote_id is null or p_cliente_id is null or p_fonte_id is null
   or length(btrim(p_fonte_id)) not between 1 and 200 or jsonb_typeof(p_matriz) is distinct from 'array'
   or octet_length(p_matriz::text) > 1048576 or jsonb_array_length(p_matriz) not between 5 and 10000 then
   raise exception 'matriz_invalida' using errcode = '22023'; end if;
 for v_linha in select value from jsonb_array_elements(p_matriz) loop
   if jsonb_typeof(v_linha) is distinct from 'array' or jsonb_array_length(v_linha) > 500 then raise exception 'linha_invalida' using errcode = '22023'; end if;
   for v_valor in select value from jsonb_array_elements(v_linha) loop
     if jsonb_typeof(v_valor) not in ('string','number','boolean','null') or octet_length(v_valor::text) > 4000 then raise exception 'celula_invalida' using errcode = '22023'; end if;
   end loop;
 end loop;
 v_payload := jsonb_build_object('tipo','receber','loteId',p_lote_id,'clienteId',p_cliente_id,'fonteId',p_fonte_id,'matriz',p_matriz);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cronograma-request:' || p_request_id::text,0));
 select * into v_comando from pcm.cronograma_importacao_comandos where request_id=p_request_id;
 if v_comando.request_id is not null then
   if v_comando.ator_id is distinct from v_actor or not config.sso_autorizar_acao('plano.gerir',v_comando.cliente_id) then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
   if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_comando.resultado;
 end if;
 if not config.sso_autorizar_acao('plano.gerir',p_cliente_id) then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array('cronograma',p_cliente_id,p_fonte_id)::text,0));
 select * into v_lote from pcm.cronograma_importacao_lotes where cliente_id=p_cliente_id and fonte_id=p_fonte_id for update;
 if not config.sso_autorizar_acao('plano.gerir',p_cliente_id) then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if found then
   if v_lote.id <> p_lote_id or v_lote.matriz is distinct from p_matriz then raise exception 'fonte_conflitante' using errcode='23505'; end if;
 else
   insert into pcm.cronograma_importacao_lotes(id,cliente_id,fonte_id,matriz,criado_por) values(p_lote_id,p_cliente_id,p_fonte_id,p_matriz,v_actor) returning * into v_lote;
   v_criado := true;
   insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.recebido','cronograma_importacao_lotes',v_lote.id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revision',1));
 end if;
 v_resultado := jsonb_build_object('aggregateId',v_lote.id,'revision',v_lote.revisao,'state','pendente','created',v_criado,'requestId',p_request_id);
 insert into pcm.cronograma_importacao_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 return v_resultado;
end;
$$;
revoke all on function pcm.sso_receber_matriz_cronograma(uuid,uuid,uuid,text,jsonb) from public,anon,service_role;
grant execute on function pcm.sso_receber_matriz_cronograma(uuid,uuid,uuid,text,jsonb) to authenticated;

create function pcm.sso_anotar_revisao_cronograma(p_request_id uuid, p_lote_id uuid, p_expected_revision integer, p_numero_linha integer, p_observacao text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_lote pcm.cronograma_importacao_lotes%rowtype; v_comando pcm.cronograma_importacao_comandos%rowtype;
 v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
 if v_actor is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision < 1
   or p_numero_linha is null or p_numero_linha < 1 or p_observacao is null or length(btrim(p_observacao)) not between 1 and 2000 then
   raise exception 'revisao_invalida' using errcode = '22023'; end if;
 v_payload := jsonb_build_object('tipo','anotar','loteId',p_lote_id,'expectedRevision',p_expected_revision,'numeroLinha',p_numero_linha,'observacao',btrim(p_observacao));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cronograma-request:' || p_request_id::text,0));
 select * into v_comando from pcm.cronograma_importacao_comandos where request_id=p_request_id;
 select * into v_lote from pcm.cronograma_importacao_lotes where id=p_lote_id for update;
 if not found or not config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if v_comando.request_id is not null then
   if v_comando.ator_id is distinct from v_actor or v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_comando.resultado;
 end if;
 if v_lote.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if p_numero_linha > jsonb_array_length(v_lote.matriz) then raise exception 'linha_inexistente' using errcode='23514'; end if;
 update pcm.cronograma_importacao_lotes set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.cronograma_importacao_revisoes(lote_id,revisao,numero_linha,observacao,ator_id)
 values(p_lote_id,v_lote.revisao,p_numero_linha,btrim(p_observacao),v_actor) returning id into v_id;
 v_resultado := jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','created',true,'requestId',p_request_id,'anotacaoId',v_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.revisado','cronograma_importacao_lotes',p_lote_id,jsonb_build_object('requestId',p_request_id,'linha',p_numero_linha,'revision',v_lote.revisao));
 insert into pcm.cronograma_importacao_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_lote.cliente_id,v_payload,v_resultado);
 return v_resultado;
end;
$$;
revoke all on function pcm.sso_anotar_revisao_cronograma(uuid,uuid,integer,integer,text) from public,anon,service_role;
grant execute on function pcm.sso_anotar_revisao_cronograma(uuid,uuid,integer,integer,text) to authenticated;

create function pcm.sso_listar_cronogramas_staging(p_cliente_id uuid, p_apos uuid, p_limite integer)
returns table (id uuid, fonte_id text, revisao integer, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not config.sso_autorizar_acao('plano.gerir',p_cliente_id) then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select l.id,l.fonte_id,l.revisao,l.criado_em from pcm.cronograma_importacao_lotes l
 where l.cliente_id=p_cliente_id and (p_apos is null or l.id>p_apos) order by l.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_cronogramas_staging(uuid,uuid,integer) from public,anon,service_role;
grant execute on function pcm.sso_listar_cronogramas_staging(uuid,uuid,integer) to authenticated;

create function pcm.sso_obter_cronograma_staging(p_cliente_id uuid, p_lote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_lote pcm.cronograma_importacao_lotes%rowtype;
begin
 if not config.sso_autorizar_acao('plano.gerir',p_cliente_id) then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 select * into v_lote from pcm.cronograma_importacao_lotes where id=p_lote_id and cliente_id=p_cliente_id;
 if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('id',v_lote.id,'clienteId',v_lote.cliente_id,'fonteId',v_lote.fonte_id,'revision',v_lote.revisao,'matriz',v_lote.matriz);
end;
$$;
revoke all on function pcm.sso_obter_cronograma_staging(uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_obter_cronograma_staging(uuid,uuid) to authenticated;
