-- ADR-0244: identidade declarada, não identidade oficial nem incorporação.
create table pcm.sso_cronograma_identidades_linha (
 id uuid primary key default gen_random_uuid(), lote_id uuid not null, chave_linha text not null,
 identidade text not null check(length(btrim(identidade)) between 1 and 200),
 revisao_lote integer not null check(revisao_lote > 1), ator_id uuid not null references auth.users(id),
 criado_em timestamptz not null default now(),
 foreign key(lote_id,chave_linha) references pcm.sso_levantamento_linhas(lote_id,chave),
 unique(lote_id,revisao_lote)
);
create index sso_cronograma_identidades_linha_idx on pcm.sso_cronograma_identidades_linha(lote_id,chave_linha,revisao_lote desc);
alter table pcm.sso_cronograma_identidades_linha enable row level security;
alter table pcm.sso_cronograma_identidades_linha force row level security;
revoke all on pcm.sso_cronograma_identidades_linha from public,anon,authenticated,service_role;
create trigger sso_cronograma_identidade_imutavel before update or delete on pcm.sso_cronograma_identidades_linha
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_identificar_linha_cronograma(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave_linha text,p_identidade text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_lote pcm.sso_levantamentos%rowtype; v_cmd pcm.sso_levantamento_comandos%rowtype;
 v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision < 1
   or p_chave_linha is null or length(btrim(p_chave_linha)) not between 1 and 200
   or p_identidade is null or length(btrim(p_identidade)) not between 1 and 200 then raise exception 'identidade_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','identificarCronograma','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chaveLinha',p_chave_linha,'identidade',btrim(p_identidade));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and origem='planilha' and chave_origem like 'cronograma:%' for update;
 if not found or config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then
   if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_cmd.resultado;
 end if;
 if v_lote.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave_linha and tipo='cronograma') then raise exception 'linha_inexistente' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_cronograma_identidades_linha i where i.lote_id=p_lote_id and i.chave_linha<>p_chave_linha and i.identidade=btrim(p_identidade)
   and not exists(select 1 from pcm.sso_cronograma_identidades_linha n where n.lote_id=i.lote_id and n.chave_linha=i.chave_linha and n.revisao_lote>i.revisao_lote)) then
   raise exception 'identidade_duplicada_no_lote' using errcode='23505'; end if;
 if config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_cronograma_identidades_linha(lote_id,chave_linha,identidade,revisao_lote,ator_id)
 values(p_lote_id,p_chave_linha,btrim(p_identidade),v_lote.revisao,v_actor) returning id into v_id;
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','identidadeId',v_id,'requestId',p_request_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.identidade_declarada','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'identidadeId',v_id,'revision',v_lote.revisao));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_identificar_linha_cronograma(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_comparar_identidades_cronograma(p_cliente_id uuid,p_anterior uuid,p_novo uuid,p_apos text,p_limite integer)
returns table(identidade text,chave_anterior text,chave_nova text,estado text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if p_cliente_id is null or p_anterior is null or p_novo is null or p_anterior=p_novo or p_limite is null or p_limite not between 1 and 100 then raise exception 'comparacao_invalida' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or
   (select count(*) from pcm.sso_levantamentos l where l.id in (p_anterior,p_novo) and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%') <> 2 then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 return query with atuais as (
   select distinct on (i.lote_id,i.chave_linha) i.lote_id,i.chave_linha,i.identidade
   from pcm.sso_cronograma_identidades_linha i where i.lote_id in (p_anterior,p_novo)
   order by i.lote_id,i.chave_linha,i.revisao_lote desc
 ), pares as (
   select coalesce(a.identidade,b.identidade) ident,a.chave_linha antiga,b.chave_linha nova
   from (select * from atuais where lote_id=p_anterior) a full join (select * from atuais where lote_id=p_novo) b on a.identidade=b.identidade
 )
 select p.ident,p.antiga,p.nova,case when p.antiga is null then 'somente_novo' when p.nova is null then 'somente_anterior'
   when la.atributos is not distinct from lb.atributos then 'atributos_iguais' else 'atributos_diferentes' end
 from pares p left join pcm.sso_levantamento_linhas la on la.lote_id=p_anterior and la.chave=p.antiga
 left join pcm.sso_levantamento_linhas lb on lb.lote_id=p_novo and lb.chave=p.nova
 where p_apos is null or p.ident>p_apos order by p.ident limit p_limite;
end; $$;
revoke all on function pcm.sso_comparar_identidades_cronograma(uuid,uuid,uuid,text,integer) from public,anon,authenticated,service_role;
