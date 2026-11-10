-- Exercita 1081 em PostgreSQL descartável com dependências simuladas; não substitui pgTAP real.
\set ON_ERROR_STOP on
begin;
create role anon; create role authenticated; create role service_role;
create schema pcm; create schema config; create schema audit; create schema auth;
create table pcm.clientes(id uuid primary key);
create table config.usuarios(user_id uuid primary key);
create table pcm.sso_levantamentos(id uuid primary key, cliente_id uuid not null, conteudo jsonb not null);
create table audit.events(actor_id uuid, action text, entity text, entity_id uuid, payload jsonb);
insert into pcm.clientes values('16891000-0000-4000-8000-000000000002');
insert into config.usuarios values('16891000-0000-4000-8000-000000000001');
create function auth.uid() returns uuid language sql stable as $$select '16891000-0000-4000-8000-000000000001'::uuid$$;
create function pcm.sso_exigir_mediacao_cronograma(p_cliente uuid) returns void language plpgsql as $$
begin if p_cliente <> '16891000-0000-4000-8000-000000000002' then raise exception 'lote_sem_acesso' using errcode='42501'; end if; end;$$;
create function pcm.sso_receber_cronograma_mediado(p_request uuid,p_lote uuid,p_cliente uuid,p_fonte text,p_matriz jsonb) returns jsonb language plpgsql as $$
declare v_criado boolean;
begin
 insert into pcm.sso_levantamentos(id,cliente_id,conteudo) values(p_lote,p_cliente,p_matriz) on conflict do nothing;
 v_criado := found;
 if p_request='16900000-0000-4000-8000-000000000111' then v_criado := true; end if; -- replay de CSV criado anteriormente
 if not exists(select 1 from pcm.sso_levantamentos where id=p_lote and cliente_id=p_cliente and conteudo=p_matriz) then raise exception 'conflito' using errcode='23505'; end if;
 return jsonb_build_object('created',v_criado,'aggregateId',p_lote,'requestId',p_request);
end;$$;
\ir ../migrations/1081_E01-S169_origem_xlsx_cronograma.sql
do $$ begin
  begin
    perform pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000101','16900000-0000-4000-8000-000000000102','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    raise exception 'gate aceitou escrita';
  exception when sqlstate '55000' then if sqlerrm <> 'origem_xlsx_bloqueada' then raise; end if; end;
end $$;
update pcm.sso_origem_xlsx_cronograma_gate set habilitado=true where id;
do $$ declare p uuid := '16900000-0000-4000-8000-000000000101'; l uuid := '16900000-0000-4000-8000-000000000102'; c uuid := '16891000-0000-4000-8000-000000000002'; h text := 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'; begin
  begin perform pcm.sso_receber_xlsx_cronograma(p,l,c,'fonte','[[1],[2],[3],[4],[5]]','YWJj',repeat('0',64)); raise exception 'digest aceito'; exception when sqlstate '22023' then if sqlerrm <> 'digest_divergente' then raise; end if; end;
  perform pcm.sso_receber_xlsx_cronograma(p,l,c,'fonte','[[1],[2],[3],[4],[5]]','YWJj',h);
  perform pcm.sso_receber_xlsx_cronograma(p,l,c,'fonte','[[1],[2],[3],[4],[5]]','YWJj',h);
  if (select bytes from pcm.sso_origens_xlsx_cronograma where lote_id=l) <> decode('YWJj','base64') then raise exception 'bytes divergentes'; end if;
  begin perform pcm.sso_receber_xlsx_cronograma(p,l,c,'fonte','[[1],[2],[3],[4],[5]]','ZGVm','cb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34'); raise exception 'conflito aceito'; exception when sqlstate '23505' then if sqlerrm <> 'origem_xlsx_conflitante' then raise; end if; end;
end $$;
insert into pcm.sso_levantamentos values('16900000-0000-4000-8000-000000000112','16891000-0000-4000-8000-000000000002','[[1],[2],[3],[4],[5]]');
do $$ begin
  begin
    perform pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000111','16900000-0000-4000-8000-000000000112','16891000-0000-4000-8000-000000000002','csv','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    raise exception 'replay CSV aceitou anexo retroativo';
  exception when sqlstate '55000' then if sqlerrm <> 'origem_xlsx_exige_reconciliacao' then raise; end if; end;
end $$;
rollback;
