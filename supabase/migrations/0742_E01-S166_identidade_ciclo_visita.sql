-- ADR-0517: namespace próprio de identidade por série/semana contratual.
create table pcm.sso_identidade_ciclo_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_identidade_ciclo_visita_gate enable row level security;alter table pcm.sso_identidade_ciclo_visita_gate force row level security;
revoke all on pcm.sso_identidade_ciclo_visita_gate from public,anon,authenticated,service_role;
insert into pcm.sso_identidade_ciclo_visita_gate(id,habilitado) values(true,false);
create table pcm.sso_ciclos_visita_canonicos (
 id uuid primary key default gen_random_uuid(),plano_id uuid not null references pcm.planos_manutencao(id),rotina_logica_id uuid not null,alvo_tipo text not null,alvo_id uuid not null,
 serie_id uuid not null references pcm.calendario_contratual_series(id),semana_origem date not null check(extract(isodow from semana_origem)=1),criado_em timestamptz not null default now(),
 unique(plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem)
);
create table pcm.sso_ciclo_visita_versoes (preparada_id uuid primary key references pcm.ocorrencias_visita_preparadas(id),ciclo_id uuid not null references pcm.sso_ciclos_visita_canonicos(id),versao_id uuid not null references pcm.plano_versoes(id),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
create table pcm.sso_identidade_visita_comandos(request_id uuid primary key,cliente_id uuid not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_ciclos_visita_canonicos enable row level security;alter table pcm.sso_ciclos_visita_canonicos force row level security;
alter table pcm.sso_ciclo_visita_versoes enable row level security;alter table pcm.sso_ciclo_visita_versoes force row level security;
alter table pcm.sso_identidade_visita_comandos enable row level security;alter table pcm.sso_identidade_visita_comandos force row level security;
revoke all on pcm.sso_ciclos_visita_canonicos,pcm.sso_ciclo_visita_versoes,pcm.sso_identidade_visita_comandos from public,anon,authenticated,service_role;
create trigger sso_ciclo_visita_canonico_imutavel before update or delete on pcm.sso_ciclos_visita_canonicos for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_ciclo_visita_versao_imutavel before update or delete on pcm.sso_ciclo_visita_versoes for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_identificar_ciclo_visita(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_visita_preparadas%rowtype;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_n integer;v_ciclo uuid;v_existente uuid;v_payload jsonb;v_resultado jsonb;v_ant pcm.sso_identidade_visita_comandos%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_identidade_ciclo_visita_gate where id),false) then raise exception 'identidade_visita_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('identidade-visita-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_identidade_visita_comandos where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'preparada_indisponivel' using errcode='42501';end if;
 select * into v_versao from pcm.plano_versoes where id=v_prep.versao_id and plano_id=v_prep.plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=v_prep.rotina_id::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'visita' or v_rotina->>'rotina_logica_id' is distinct from v_prep.rotina_logica_id::text or v_rotina->>'alvo_tipo' is distinct from v_prep.alvo_tipo or coalesce(v_rotina->>'sistema_id',v_rotina->>'equipamento_id',v_rotina->>'grupo_id') is distinct from v_prep.alvo_id::text then raise exception 'identidade_historica_incompativel' using errcode='23514';end if;
 if not exists(select 1 from pcm.visita_origem_contratual o where o.visita_id=v_prep.visita_id and o.cliente_id=p_cliente_id and o.serie_id=v_prep.serie_id and o.semana_origem=v_prep.semana_origem) then raise exception 'origem_contratual_nao_comprovada' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 insert into pcm.sso_ciclos_visita_canonicos(plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem) values(v_prep.plano_id,v_prep.rotina_logica_id,v_prep.alvo_tipo,v_prep.alvo_id,v_prep.serie_id,v_prep.semana_origem) on conflict(plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem) do nothing returning id into v_ciclo;
 if v_ciclo is null then select id into v_ciclo from pcm.sso_ciclos_visita_canonicos where plano_id=v_prep.plano_id and rotina_logica_id=v_prep.rotina_logica_id and alvo_tipo=v_prep.alvo_tipo and alvo_id=v_prep.alvo_id and serie_id=v_prep.serie_id and semana_origem=v_prep.semana_origem;end if;
 insert into pcm.sso_ciclo_visita_versoes(preparada_id,ciclo_id,versao_id,ator_id) values(p_preparada_id,v_ciclo,v_prep.versao_id,v_actor) on conflict(preparada_id) do nothing;
 select ciclo_id into v_existente from pcm.sso_ciclo_visita_versoes where preparada_id=p_preparada_id;
 if v_existente is distinct from v_ciclo then raise exception 'preparada_ja_vinculada_a_outro_ciclo' using errcode='23505';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'cicloVisitaId',v_ciclo,'serieId',v_prep.serie_id,'semanaOrigem',v_prep.semana_origem,'ocorrenciaCriada',false,'osCriada',false);
 insert into pcm.sso_identidade_visita_comandos(request_id,cliente_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ciclo_visita_identificado','planos_manutencao',v_prep.plano_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_identificar_ciclo_visita(uuid,uuid,uuid) from public,anon,authenticated,service_role;
