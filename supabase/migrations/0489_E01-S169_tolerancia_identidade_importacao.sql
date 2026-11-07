-- ADR-0263: tolerâncias explícitas revisionadas e estrutura privada de vínculo.
create table pcm.sso_cronograma_tolerancias_mapeamento (
 id uuid primary key default gen_random_uuid(),lote_id uuid not null,chave_linha text not null,mapeamento_id uuid not null references pcm.sso_cronograma_mapeamentos(id),
 revisao_lote integer not null check(revisao_lote>1),antes integer not null check(antes>=0),depois integer not null check(depois>=0),
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
 foreign key(lote_id,chave_linha) references pcm.sso_levantamento_linhas(lote_id,chave),unique(lote_id,revisao_lote)
);
create index sso_cronograma_tolerancias_idx on pcm.sso_cronograma_tolerancias_mapeamento(lote_id,chave_linha,revisao_lote desc);
alter table pcm.sso_cronograma_tolerancias_mapeamento enable row level security;
alter table pcm.sso_cronograma_tolerancias_mapeamento force row level security;
revoke all on pcm.sso_cronograma_tolerancias_mapeamento from public,anon,authenticated,service_role;
create trigger sso_cronograma_tolerancia_imutavel before update or delete on pcm.sso_cronograma_tolerancias_mapeamento for each row execute function pcm.sso_proteger_conferencia_levantamento();

create table pcm.sso_cronograma_rotina_origem (
 id uuid primary key default gen_random_uuid(),cliente_id uuid not null references pcm.clientes(id),plano_id uuid not null references pcm.planos_manutencao(id),
 identidade text not null check(length(btrim(identidade)) between 1 and 200),rotina_id uuid not null references pcm.rotinas_manutencao(id),
 lote_id uuid not null,chave_linha text not null,aprovacao_id uuid not null references pcm.sso_cronograma_aprovacoes(id),
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
 foreign key(lote_id,chave_linha) references pcm.sso_levantamento_linhas(lote_id,chave),unique(cliente_id,plano_id,identidade),unique(rotina_id)
);
alter table pcm.sso_cronograma_rotina_origem enable row level security;
alter table pcm.sso_cronograma_rotina_origem force row level security;
revoke all on pcm.sso_cronograma_rotina_origem from public,anon,authenticated,service_role;
create trigger sso_cronograma_rotina_origem_imutavel before update or delete on pcm.sso_cronograma_rotina_origem for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_tolerancia_mapeamento_cronograma(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_mapeamento_id uuid,p_antes integer,p_depois integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_mapeamento_id is null or p_antes is null or p_antes<0 or p_depois is null or p_depois<0 then raise exception 'tolerancia_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','toleranciaCronograma','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'mapeamentoId',p_mapeamento_id,'antes',p_antes,'depois',p_depois);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and origem='planilha' and chave_origem like 'cronograma:%' for update;
 if not found or config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then
  if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_cmd.resultado;
 end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_cronograma_mapeamentos m where m.id=p_mapeamento_id and m.lote_id=p_lote_id and m.chave_linha=p_chave and not exists(select 1 from pcm.sso_cronograma_mapeamentos n where n.lote_id=m.lote_id and n.chave_linha=m.chave_linha and n.revisao_lote>m.revisao_lote)) then raise exception 'mapeamento_obsoleto' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_cronograma_tolerancias_mapeamento(lote_id,chave_linha,mapeamento_id,revisao_lote,antes,depois,ator_id) values(p_lote_id,p_chave,p_mapeamento_id,v_lote.revisao,p_antes,p_depois,v_actor) returning id into v_id;
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','toleranciaId',v_id,'requestId',p_request_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.tolerancia_declarada','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'toleranciaId',v_id,'revision',v_lote.revisao));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado); return v_resultado;
end; $$;
revoke all on function pcm.sso_tolerancia_mapeamento_cronograma(uuid,uuid,integer,text,uuid,integer,integer) from public,anon,authenticated,service_role;

-- A ausência de configuração corresponde a zero; mudança de tolerância invalida conferência anterior.
create or replace function pcm.sso_conferir_linhas_cronograma(p_cliente_id uuid,p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo_linha text,conferencia text,identidade text,mapeamento_id uuid,situacao text,pendencias text[])
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%') then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 return query select l.chave,c.tipo_linha,c.conferencia,i.identidade,m.id,r.estado,array_remove(array[
  case when c.id is null then 'classificacao_ausente' end,
  case when c.id is not null and c.conferencia<>'concluida' then 'conferencia_pendente' end,
  case when c.conferencia='concluida' and greatest(coalesce(i.revisao_lote,0),coalesce(m.revisao_lote,0),coalesce(r.revisao_lote,0),coalesce(t.revisao_lote,0))>c.revisao_lote then 'conferencia_desatualizada' end,
  case when c.tipo_linha='dado' and r.estado is distinct from 'rejeitada' and i.id is null then 'identidade_ausente' end,
  case when c.tipo_linha='dado' and r.estado is distinct from 'rejeitada' and m.id is null then 'mapeamento_ausente' end]::text[],null)
 from pcm.sso_levantamento_linhas l
 left join lateral (select x.* from pcm.sso_cronograma_classificacoes_linha x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) c on true
 left join lateral (select x.* from pcm.sso_cronograma_identidades_linha x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) i on true
 left join lateral (select x.* from pcm.sso_cronograma_mapeamentos x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) m on true
 left join lateral (select x.* from pcm.sso_cronograma_revisoes_linha x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) r on true
 left join lateral (select x.* from pcm.sso_cronograma_tolerancias_mapeamento x where x.lote_id=l.lote_id and x.chave_linha=l.chave and x.mapeamento_id=m.id order by x.revisao_lote desc limit 1) t on true
 where l.lote_id=p_lote_id and l.tipo='cronograma' and (p_apos is null or l.chave>p_apos) order by l.chave limit p_limite;
end; $$;
revoke all on function pcm.sso_conferir_linhas_cronograma(uuid,uuid,text,integer) from public,anon,authenticated,service_role;

create function pcm.sso_obter_tolerancia_cronograma(p_cliente_id uuid,p_lote_id uuid,p_mapeamento_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_t pcm.sso_cronograma_tolerancias_mapeamento%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_levantamentos l join pcm.sso_cronograma_mapeamentos m on m.lote_id=l.id where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%' and m.id=p_mapeamento_id) then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 select * into v_t from pcm.sso_cronograma_tolerancias_mapeamento where lote_id=p_lote_id and mapeamento_id=p_mapeamento_id order by revisao_lote desc limit 1;
 return jsonb_build_object('antes',coalesce(v_t.antes,0),'depois',coalesce(v_t.depois,0),'configurada',v_t.id is not null,'revision',v_t.revisao_lote);
end; $$;
revoke all on function pcm.sso_obter_tolerancia_cronograma(uuid,uuid,uuid) from public,anon,authenticated,service_role;
