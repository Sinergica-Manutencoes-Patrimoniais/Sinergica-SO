-- ADR-0519: adaptação da 0455, com identidade de Visita e token transacional.
create table pcm.sso_materializar_visita_canonica_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_materializar_visita_canonica_gate enable row level security;alter table pcm.sso_materializar_visita_canonica_gate force row level security;
revoke all on pcm.sso_materializar_visita_canonica_gate from public,anon,authenticated,service_role;
insert into pcm.sso_materializar_visita_canonica_gate(id,habilitado) values(true,false);
create table pcm.sso_materializacao_visita_tokens(txid bigint not null,plano_id uuid not null,versao_id uuid not null,rotina_id uuid not null,visita_id uuid not null,primary key(txid,plano_id,versao_id,rotina_id,visita_id));
create table pcm.sso_ciclo_visita_usos_versao(ciclo_id uuid not null references pcm.sso_ciclos_visita_canonicos(id),versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null references pcm.rotinas_manutencao(id),preparada_id uuid not null references pcm.ocorrencias_visita_preparadas(id),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),primary key(ciclo_id,versao_id));
alter table pcm.sso_materializacao_visita_tokens enable row level security;alter table pcm.sso_materializacao_visita_tokens force row level security;
alter table pcm.sso_ciclo_visita_usos_versao enable row level security;alter table pcm.sso_ciclo_visita_usos_versao force row level security;
revoke all on pcm.sso_materializacao_visita_tokens,pcm.sso_ciclo_visita_usos_versao from public,anon,authenticated,service_role;
create trigger sso_ciclo_visita_uso_imutavel before update or delete on pcm.sso_ciclo_visita_usos_versao for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_guardar_materializacao_visita_canonica() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_materializar_visita_canonica_gate where id),false) then return new;end if;
 if not exists(select 1 from pcm.sso_materializacao_visita_tokens t where t.txid=pg_catalog.txid_current() and t.plano_id=new.plano_id and t.versao_id=new.versao_id and t.rotina_id=new.rotina_id and t.visita_id=new.visita_id) then raise exception 'materializacao_exige_identidade_visita' using errcode='23514';end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_materializacao_visita_canonica() from public,anon,authenticated,service_role;
create trigger sso_guardar_materializacao_visita_canonica before insert on pcm.ocorrencias_visita_preparadas for each row execute function pcm.sso_guardar_materializacao_visita_canonica();

create function pcm.sso_preparar_visita_canonica(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_visita_id uuid,p_expected_revision integer,p_fonte_dia_util text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_n integer;v_prep pcm.ocorrencias_visita_preparadas%rowtype;v_comando pcm.calendario_contratual_comandos%rowtype;v_payload jsonb;v_preparada jsonb;v_identidade jsonb;v_resultado jsonb;v_ciclo uuid;v_alvo uuid;v_existente pcm.sso_ciclo_visita_usos_versao%rowtype;v_fonte text:=nullif(btrim(p_fonte_dia_util),'');
begin
 if not coalesce((select habilitado from pcm.sso_materializar_visita_canonica_gate where id),false) or not coalesce((select habilitado from pcm.sso_identidade_ciclo_visita_gate where id),false) or not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_visita_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_visita_id is null or p_expected_revision is null or p_expected_revision<1 or v_fonte is null or length(v_fonte)>500 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('tipo','prepararVisitaCanonica','clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'visitaId',p_visita_id,'expectedRevision',p_expected_revision,'fonteDiaUtil',v_fonte);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_comando from pcm.calendario_contratual_comandos where request_id=p_request_id;
 if found then if v_comando.actor_id is distinct from v_actor or v_comando.cliente_id is distinct from p_cliente_id or v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_comando.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or v_plano.revisao<>p_expected_revision then raise exception 'revisao_ou_plano_indisponivel' using errcode='40001';end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_id::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'visita' then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 insert into pcm.sso_materializacao_visita_tokens(txid,plano_id,versao_id,rotina_id,visita_id) values(pg_catalog.txid_current(),p_plano_id,p_versao_id,p_rotina_id,p_visita_id);
 v_preparada:=pcm.sso_preparar_ocorrencia_por_visita(gen_random_uuid(),p_ocorrencia_id,p_plano_id,p_versao_id,p_rotina_id,p_visita_id,p_expected_revision,v_fonte);
 delete from pcm.sso_materializacao_visita_tokens where txid=pg_catalog.txid_current() and plano_id=p_plano_id and versao_id=p_versao_id and rotina_id=p_rotina_id and visita_id=p_visita_id;
 select * into v_prep from pcm.ocorrencias_visita_preparadas where id=(v_preparada->>'ocorrenciaId')::uuid for update;
 v_alvo:=case v_rotina->>'alvo_tipo' when 'sistema' then (v_rotina->>'sistema_id')::uuid when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;
 if not found or v_prep.plano_id<>p_plano_id or v_prep.rotina_logica_id::text is distinct from v_rotina->>'rotina_logica_id' or v_prep.alvo_tipo is distinct from v_rotina->>'alvo_tipo' or v_prep.alvo_id is distinct from v_alvo or v_prep.visita_id<>p_visita_id then raise exception 'identidade_exige_reconciliacao' using errcode='23514';end if;
 v_identidade:=pcm.sso_identificar_ciclo_visita(gen_random_uuid(),p_cliente_id,v_prep.id);v_ciclo:=(v_identidade->>'cicloVisitaId')::uuid;
 insert into pcm.sso_ciclo_visita_usos_versao(ciclo_id,versao_id,rotina_id,preparada_id,ator_id) values(v_ciclo,p_versao_id,p_rotina_id,v_prep.id,v_actor) on conflict(ciclo_id,versao_id) do nothing;
 select * into v_existente from pcm.sso_ciclo_visita_usos_versao where ciclo_id=v_ciclo and versao_id=p_versao_id;
 if v_existente.rotina_id is distinct from p_rotina_id or v_existente.preparada_id is distinct from v_prep.id then raise exception 'uso_versao_conflitante' using errcode='23505';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'ocorrenciaId',v_prep.id,'cicloVisitaId',v_ciclo,'visitaId',p_visita_id,'criada',v_preparada->'criada','osCriada',false,'tarefaAuvoCriada',false,'fonteFeriadosCompleta',false);
 insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ocorrencia_visita_canonica','planos_manutencao',p_plano_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_preparar_visita_canonica(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
