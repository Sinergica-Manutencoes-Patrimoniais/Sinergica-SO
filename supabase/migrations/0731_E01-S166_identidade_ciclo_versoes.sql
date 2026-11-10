-- ADR-0506: identidade por série de regra congelada + índice, nunca só por data.
create table pcm.sso_identidade_ciclo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_identidade_ciclo_gate enable row level security;
alter table pcm.sso_identidade_ciclo_gate force row level security;
revoke all on pcm.sso_identidade_ciclo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_identidade_ciclo_gate(id,habilitado) values(true,false);
create table pcm.sso_series_ciclo_calendario (
 id uuid primary key default gen_random_uuid(),plano_id uuid not null references pcm.planos_manutencao(id),rotina_logica_id uuid not null,alvo_tipo text not null,alvo_id uuid not null,ancora date not null,intervalo_n integer not null check(intervalo_n>0),intervalo_unidade text not null check(intervalo_unidade in ('dias','semanas','meses','anos')),
 criado_em timestamptz not null default now(),unique(plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade)
);
create table pcm.sso_ciclos_calendario_canonicos (
 id uuid primary key default gen_random_uuid(),serie_id uuid not null references pcm.sso_series_ciclo_calendario(id),indice integer not null check(indice>=0),vencimento_original date not null,criado_em timestamptz not null default now(),unique(serie_id,indice)
);
create table pcm.sso_ciclo_calendario_versoes (
 preparada_id uuid primary key references pcm.ocorrencias_rotina_preparadas(id),ciclo_id uuid not null references pcm.sso_ciclos_calendario_canonicos(id),versao_id uuid not null references pcm.plano_versoes(id),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
create table pcm.sso_identidade_ciclo_comandos(request_id uuid primary key,cliente_id uuid not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_series_ciclo_calendario enable row level security;alter table pcm.sso_series_ciclo_calendario force row level security;
alter table pcm.sso_ciclos_calendario_canonicos enable row level security;alter table pcm.sso_ciclos_calendario_canonicos force row level security;
alter table pcm.sso_ciclo_calendario_versoes enable row level security;alter table pcm.sso_ciclo_calendario_versoes force row level security;
alter table pcm.sso_identidade_ciclo_comandos enable row level security;alter table pcm.sso_identidade_ciclo_comandos force row level security;
revoke all on pcm.sso_series_ciclo_calendario,pcm.sso_ciclos_calendario_canonicos,pcm.sso_ciclo_calendario_versoes,pcm.sso_identidade_ciclo_comandos from public,anon,authenticated,service_role;
create trigger sso_serie_ciclo_imutavel before update or delete on pcm.sso_series_ciclo_calendario for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_ciclo_canonico_imutavel before update or delete on pcm.sso_ciclos_calendario_canonicos for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_ciclo_versao_imutavel before update or delete on pcm.sso_ciclo_calendario_versoes for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_identificar_ciclo_calendario(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_n integer;v_ancora date;v_intervalo integer;v_unidade text;v_serie uuid;v_ciclo uuid;v_ciclo_existente uuid;v_payload jsonb;v_resultado jsonb;v_ant pcm.sso_identidade_ciclo_comandos%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_identidade_ciclo_gate where id),false) then raise exception 'identidade_ciclo_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('identidade-ciclo-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_identidade_ciclo_comandos where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'preparada_indisponivel' using errcode='42501';end if;
 select * into v_versao from pcm.plano_versoes where id=v_prep.versao_id and plano_id=v_prep.plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=v_prep.rotina_id::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'calendario' or v_rotina->>'rotina_logica_id' is distinct from v_prep.rotina_logica_id::text or v_rotina->>'alvo_tipo' is distinct from v_prep.alvo_tipo or coalesce(v_rotina->>'sistema_id',v_rotina->>'equipamento_id',v_rotina->>'grupo_id') is distinct from v_prep.alvo_id::text then raise exception 'identidade_historica_incompativel' using errcode='23514';end if;
 v_ancora:=(v_rotina->>'data_base')::date;v_intervalo:=(v_rotina->>'intervalo_n')::integer;v_unidade:=v_rotina->>'intervalo_unidade';
 if pcm.sso_vencimento_ciclo_calendario(v_ancora,v_intervalo,v_unidade,v_prep.ciclo) is distinct from v_prep.vencimento_original then raise exception 'ciclo_incompativel' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 insert into pcm.sso_series_ciclo_calendario(plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade) values(v_prep.plano_id,v_prep.rotina_logica_id,v_prep.alvo_tipo,v_prep.alvo_id,v_ancora,v_intervalo,v_unidade) on conflict(plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade) do nothing returning id into v_serie;
 if v_serie is null then select id into v_serie from pcm.sso_series_ciclo_calendario where plano_id=v_prep.plano_id and rotina_logica_id=v_prep.rotina_logica_id and alvo_tipo=v_prep.alvo_tipo and alvo_id=v_prep.alvo_id and ancora=v_ancora and intervalo_n=v_intervalo and intervalo_unidade=v_unidade;end if;
 insert into pcm.sso_ciclos_calendario_canonicos(serie_id,indice,vencimento_original) values(v_serie,v_prep.ciclo,v_prep.vencimento_original) on conflict(serie_id,indice) do nothing returning id into v_ciclo;
 if v_ciclo is null then select id into v_ciclo from pcm.sso_ciclos_calendario_canonicos where serie_id=v_serie and indice=v_prep.ciclo and vencimento_original=v_prep.vencimento_original;end if;
 if v_ciclo is null then raise exception 'identidade_ciclo_conflitante' using errcode='23514';end if;
 insert into pcm.sso_ciclo_calendario_versoes(preparada_id,ciclo_id,versao_id,ator_id) values(p_preparada_id,v_ciclo,v_prep.versao_id,v_actor) on conflict(preparada_id) do nothing;
 select ciclo_id into v_ciclo_existente from pcm.sso_ciclo_calendario_versoes where preparada_id=p_preparada_id;
 if v_ciclo_existente is distinct from v_ciclo then raise exception 'preparada_ja_vinculada_a_outro_ciclo' using errcode='23505';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'serieId',v_serie,'cicloCanonicoId',v_ciclo,'indice',v_prep.ciclo,'vencimentoOriginal',v_prep.vencimento_original,'ocorrenciaCriada',false,'vinculoLegadoAlterado',false);
 insert into pcm.sso_identidade_ciclo_comandos(request_id,cliente_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ciclo_identificado','planos_manutencao',v_prep.plano_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_identificar_ciclo_calendario(uuid,uuid,uuid) from public,anon,authenticated,service_role;
