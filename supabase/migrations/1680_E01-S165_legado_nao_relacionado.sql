-- ADR-1537: classificação humana por par, sem inferir equivalência positiva.
create table pcm.sso_legados_nao_relacionados (
 request_id uuid primary key, cliente_id uuid not null, plano_id uuid not null references pcm.planos_manutencao(id),
 legado_id uuid not null references pcm.planos_preventivos(id), revisao_plano integer not null, fotografia jsonb not null,
 contexto text not null, motivo text not null, ator_id uuid not null references auth.users(id), payload jsonb not null,
 resultado jsonb not null, criado_em timestamptz not null default clock_timestamp()
);
create index sso_legados_nao_relacionados_busca on pcm.sso_legados_nao_relacionados(plano_id,legado_id,criado_em desc,request_id desc);
alter table pcm.sso_legados_nao_relacionados enable row level security;
alter table pcm.sso_legados_nao_relacionados force row level security;
revoke all on pcm.sso_legados_nao_relacionados from public,anon,authenticated,service_role;
create trigger sso_legados_nao_relacionados_imutavel before update or delete on pcm.sso_legados_nao_relacionados for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_fotografia_legado_nao_relacionado(p_cliente uuid,p_plano uuid,p_legado uuid,p_revisao integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plano jsonb;v_legado jsonb;v_rel jsonb;v_ocorrencias jsonb;v_os jsonb;v_n bigint;
begin
 select to_jsonb(p) into v_plano from pcm.planos_manutencao p where p.id=p_plano and p.cliente_id=p_cliente and p.revisao=p_revisao;
 select to_jsonb(p) into v_legado from pcm.planos_preventivos p where p.id=p_legado and p.cliente_id=p_cliente;
 if v_plano is null or v_legado is null then raise exception 'plano_ou_revisao_indisponivel' using errcode='40001';end if;
 select to_jsonb(d) into v_rel from pcm.sso_declaracoes_planos_legados d where d.cliente_id=p_cliente and d.plano_id=p_plano and d.plano_legado_id=p_legado order by d.revisao desc limit 1;
 if v_rel->>'decisao'='declarar' then raise exception 'relacao_declarada_existente' using errcode='23514';end if;
 select count(*),coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) into v_n,v_ocorrencias from pcm.ocorrencias_preventivas o where o.plano_id=p_legado;
 if v_n>1000 then raise exception 'legado_excede_limite_conferencia' using errcode='54000';end if;
 if exists(select 1 from pcm.ordens_servico o join pcm.ocorrencias_preventivas x on x.id=o.ocorrencia_preventiva_id where x.plano_id=p_legado and o.client_id is distinct from p_cliente) then raise exception 'os_cliente_divergente' using errcode='23514';end if;
 select count(*),coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) into v_n,v_os from pcm.ordens_servico o join pcm.ocorrencias_preventivas x on x.id=o.ocorrencia_preventiva_id where x.plano_id=p_legado and o.client_id=p_cliente;
 if v_n>1000 then raise exception 'legado_excede_limite_conferencia' using errcode='54000';end if;
 return jsonb_build_object('plano',v_plano,'legado',v_legado,'ultimaRelacao',v_rel,'ocorrencias',v_ocorrencias,'os',v_os);
end; $$;
revoke all on function pcm.sso_fotografia_legado_nao_relacionado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_prever_legado_nao_relacionado(p_ator uuid,p_cliente uuid,p_plano uuid,p_legado uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare f jsonb;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 lock table pcm.planos_manutencao,pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_declaracoes_planos_legados in share mode nowait;
 f:=pcm.sso_fotografia_legado_nao_relacionado(p_cliente,p_plano,p_legado,p_revisao);
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 return jsonb_build_object('hash',encode(pg_catalog.sha256(pg_catalog.convert_to(f::text,'UTF8')),'hex'),'plano',f->'plano'->>'nome','legado',f->'legado'->>'nome','sistemaId',f->'legado'->'sistema_id','equipamentoId',f->'legado'->'equipamento_id','primeiraData',f->'legado'->'primeira_data','intervaloN',f->'legado'->'intervalo_n','intervaloUnidade',f->'legado'->'intervalo_unidade','ocorrencias',jsonb_array_length(f->'ocorrencias'),'os',jsonb_array_length(f->'os'),'fontesExternasComprovadas',false);
end; $$;
revoke all on function pcm.sso_prever_legado_nao_relacionado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_legado_nao_relacionado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_classificar_legado_nao_relacionado(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_legado uuid,p_revisao integer,p_hash text,p_contexto text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare f jsonb;v_payload jsonb;v_ant pcm.sso_legados_nao_relacionados%rowtype;v_resultado jsonb;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,true);
 if p_request is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or nullif(btrim(p_contexto),'') is null or length(p_contexto)>2000 or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'legado',p_legado,'revisao',p_revisao,'hash',p_hash,'contexto',btrim(p_contexto),'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('legado-nao-relacionado:'||p_request::text,0));
 select * into v_ant from pcm.sso_legados_nao_relacionados where request_id=p_request;
 if found then if v_ant.ator_id is distinct from p_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente and revisao=p_revisao for update nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 lock table pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_declaracoes_planos_legados in share mode nowait;
 f:=pcm.sso_fotografia_legado_nao_relacionado(p_cliente,p_plano,p_legado,p_revisao);
 if encode(pg_catalog.sha256(pg_catalog.convert_to(f::text,'UTF8')),'hex') is distinct from p_hash then raise exception 'fotografia_obsoleta' using errcode='40001';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request,'planoId',p_plano,'legadoId',p_legado,'classificacao','nao_relacionado','fontesExternasComprovadas',false,'aprovacaoAutorizada',false);
 insert into pcm.sso_legados_nao_relacionados values(p_request,p_cliente,p_plano,p_legado,p_revisao,f,btrim(p_contexto),btrim(p_motivo),p_ator,v_payload,v_resultado,clock_timestamp());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'plano.legado_nao_relacionado','planos_manutencao',p_plano,v_resultado||jsonb_build_object('contexto',btrim(p_contexto),'motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_classificar_legado_nao_relacionado(uuid,uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_classificar_legado_nao_relacionado(uuid,uuid,uuid,uuid,uuid,integer,text,text,text) to authenticated;

create function pcm.sso_legado_nao_relacionado_atual(p_cliente uuid,p_plano uuid,p_legado uuid,p_revisao integer) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_legados_nao_relacionados%rowtype;f jsonb;
begin
 select * into v from pcm.sso_legados_nao_relacionados where cliente_id=p_cliente and plano_id=p_plano and legado_id=p_legado order by criado_em desc,request_id desc limit 1;
 if not found or v.revisao_plano is distinct from p_revisao then return false;end if;
 begin f:=pcm.sso_fotografia_legado_nao_relacionado(p_cliente,p_plano,p_legado,p_revisao);exception when check_violation or serialization_failure then return false;end;
 return v.fotografia is not distinct from f;
end; $$;
revoke all on function pcm.sso_legado_nao_relacionado_atual(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

-- Integra a avaliação já utilizada pela aprovação. Fontes são travadas até o fim da transação.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)'::regprocedure);
 a text:='not exists(select 1 from declaradas d where d.plano_legado_id=p.id)';
 b text:='not exists(select 1 from declaradas d where d.plano_legado_id=p.id) and not pcm.sso_legado_nao_relacionado_atual(p_cliente_id,p_plano_id,p.id,p_expected_plano)';
 s text:=' v_previa:=pcm.sso_previa_revisao_revisionada';
 t text:=' lock table pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait;'||E'\n'||s;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,s,'')))/length(s)<>1 or (length(d)-length(replace(d,' STABLE SECURITY DEFINER','')))/length(' STABLE SECURITY DEFINER')<>1 then raise exception 'definicao_avaliacao_incompativel' using errcode='55000';end if;
 execute replace(replace(replace(d,a,b),s,t),' STABLE SECURITY DEFINER',' VOLATILE SECURITY DEFINER');
end; $migracao$;
