-- ADR-0467: comando preparado, nunca envia tarefa externa.
create table pcm.sso_gerar_visita_contratual_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_gerar_visita_contratual_gate enable row level security;
alter table pcm.sso_gerar_visita_contratual_gate force row level security;
revoke all on pcm.sso_gerar_visita_contratual_gate from public,anon,authenticated,service_role;
insert into pcm.sso_gerar_visita_contratual_gate(id,habilitado) values(true,false);
create table pcm.sso_geracao_visita_contratual (
 request_id uuid primary key,cliente_id uuid not null,serie_id uuid not null references pcm.calendario_contratual_series(id),regra_id uuid not null references pcm.regras_visita_contratual(id),semana date not null,decisao text not null check(decisao in ('criada','suprimida_feriado')),
 visita_id uuid references pcm.visitas(id),cobertura_declarada text not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),payload jsonb not null,resultado jsonb not null,unique(serie_id,semana)
);
alter table pcm.sso_geracao_visita_contratual enable row level security;
alter table pcm.sso_geracao_visita_contratual force row level security;
revoke all on pcm.sso_geracao_visita_contratual from public,anon,authenticated,service_role;
create trigger sso_geracao_visita_contratual_imutavel before update or delete on pcm.sso_geracao_visita_contratual for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_gerar_visita_contratual(p_request_id uuid,p_cliente_id uuid,p_serie_id uuid,p_regra_id uuid,p_semana date,p_visita_id uuid,p_inicio_em timestamptz,p_responsavel_id uuid,p_cobertura text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_serie pcm.calendario_contratual_series%rowtype;v_regra pcm.regras_visita_contratual%rowtype;v_ant pcm.sso_geracao_visita_contratual%rowtype;v_payload jsonb;v_resultado jsonb;v_criada jsonb;v_data date;v_feriado boolean;v_cobertura text:=nullif(btrim(p_cobertura),'');
begin
 if not coalesce((select habilitado from pcm.sso_gerar_visita_contratual_gate where id),false) or not coalesce((select habilitado from pcm.feriado_declarado_gate where id),false) or not coalesce((select habilitado from pcm.sso_origem_contratual_unica_gate where id),false) then raise exception 'geracao_visita_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_serie_id is null or p_regra_id is null or p_semana is null or not isfinite(p_semana) or extract(isodow from p_semana)<>1 or p_visita_id is null or p_inicio_em is null or not isfinite(p_inicio_em) or v_cobertura is null or length(v_cobertura)>500 then raise exception 'geracao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'serieId',p_serie_id,'regraId',p_regra_id,'semana',p_semana,'visitaId',p_visita_id,'inicioEm',p_inicio_em,'responsavelId',p_responsavel_id,'coberturaDeclarada',v_cobertura);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-contratual-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_geracao_visita_contratual where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;end if;
 select * into v_serie from pcm.calendario_contratual_series where id=p_serie_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
 select * into v_regra from pcm.regras_visita_contratual where id=p_regra_id and serie_id=p_serie_id for share;
 if not found or p_semana<v_regra.ancora_semana or mod(p_semana-v_regra.ancora_semana,7*v_regra.intervalo_semanas)<>0 then raise exception 'semana_incompativel' using errcode='23514'; end if;
 v_data:=p_semana+(v_regra.dia_semana-1);
 if v_data<v_regra.vigencia_inicio or (v_regra.vigencia_fim is not null and v_data>v_regra.vigencia_fim) or (p_inicio_em at time zone v_regra.fuso)::date<>v_data or (p_inicio_em at time zone v_regra.fuso)::time<>v_regra.hora_inicio then raise exception 'regra_ou_inicio_incompativel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_geracao_visita_contratual where serie_id=p_serie_id and semana=p_semana) or exists(select 1 from pcm.visita_origem_contratual where serie_id=p_serie_id and semana_origem=p_semana) then raise exception 'semana_ja_processada_ou_requer_reconciliacao' using errcode='23505'; end if;
 select exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.ativo and f.data=v_data and (f.contrato_id is null or f.contrato_id=v_serie.contrato_id)) into v_feriado;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_feriado then
  v_resultado:=jsonb_build_object('requestId',p_request_id,'decisao','suprimida_feriado','visitaCriada',false,'reposicaoCriada',false,'feriadosCoberturaDeclarada',true,'fonteOficialComprovada',false);
 else
  v_criada:=pcm.sso_criar_visita_rascunho(gen_random_uuid(),0,p_visita_id,p_cliente_id,v_serie.contrato_id,null,null,p_inicio_em,p_inicio_em+pg_catalog.make_interval(mins=>v_regra.duracao_minutos),v_regra.fuso,'regular',p_responsavel_id,v_regra.deslocamento_minutos);
  insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) values(p_visita_id,p_cliente_id,v_serie.contrato_id,p_serie_id,p_regra_id,p_semana,v_actor);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'decisao','criada','visitaCriada',true,'visitaId',p_visita_id,'reposicaoCriada',false,'feriadosCoberturaDeclarada',true,'fonteOficialComprovada',false);
 end if;
 insert into pcm.sso_geracao_visita_contratual(request_id,cliente_id,serie_id,regra_id,semana,decisao,visita_id,cobertura_declarada,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_serie_id,p_regra_id,p_semana,case when v_feriado then 'suprimida_feriado' else 'criada' end,case when v_feriado then null else p_visita_id end,v_cobertura,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.visita_contratual_processada','calendario_contratual_series',p_serie_id,v_resultado||jsonb_build_object('semana',p_semana,'coberturaDeclarada',v_cobertura));return v_resultado;
end; $$;
revoke all on function pcm.sso_gerar_visita_contratual(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_regras_geracao_visita(p_cliente_id uuid,p_serie_id uuid,p_apos integer default 0,p_limite integer default 20)
returns table(id uuid,numero integer,ancora_semana date,dia_semana integer,intervalo_semanas integer,hora_inicio time,fuso text,vigencia_inicio date,vigencia_fim date)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_gerar_visita_contratual_gate where id),false) then raise exception 'geracao_visita_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.calendario_contratual_series where id=p_serie_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select r.id,r.numero,r.ancora_semana,r.dia_semana,r.intervalo_semanas,r.hora_inicio,r.fuso,r.vigencia_inicio,r.vigencia_fim from pcm.regras_visita_contratual r where r.serie_id=p_serie_id and r.numero>p_apos order by r.numero limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_regras_geracao_visita(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
