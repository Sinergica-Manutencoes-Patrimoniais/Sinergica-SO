-- ADR-0675: lote atômico do gerador canônico, sem OS ou Auvo.
create table pcm.sso_lote_visita_canonica_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_lote_visita_canonica_gate enable row level security;alter table pcm.sso_lote_visita_canonica_gate force row level security;
revoke all on pcm.sso_lote_visita_canonica_gate from public,anon,authenticated,service_role;
insert into pcm.sso_lote_visita_canonica_gate(id,habilitado) values(true,false);
create table pcm.sso_lotes_visita_canonica(request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),plano_id uuid not null references pcm.planos_manutencao(id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_lotes_visita_canonica enable row level security;alter table pcm.sso_lotes_visita_canonica force row level security;
revoke all on pcm.sso_lotes_visita_canonica from public,anon,authenticated,service_role;
create trigger sso_lote_visita_canonica_imutavel before update or delete on pcm.sso_lotes_visita_canonica for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_preparar_lote_visita_canonica(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_itens jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_ant pcm.sso_lotes_visita_canonica%rowtype;v_item jsonb;v_itens jsonb;v_resultados jsonb:='[]'::jsonb;v_payload jsonb;v_resultado jsonb;v_rev integer;
begin
 if not coalesce((select habilitado from pcm.sso_lote_visita_canonica_gate where id),false) then raise exception 'lote_visita_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if jsonb_array_length(p_itens) not between 1 and 25 or exists(select 1 from jsonb_array_elements(p_itens) x(item) where jsonb_typeof(item) is distinct from 'object') then raise exception 'itens_invalidos' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_itens) x(item) where not (item ?& array['visitaId','ocorrenciaId','fonteDiaUtil']) or (select count(*) from jsonb_object_keys(item))<>3 or jsonb_typeof(item->'visitaId') is distinct from 'string' or jsonb_typeof(item->'ocorrenciaId') is distinct from 'string' or jsonb_typeof(item->'fonteDiaUtil') is distinct from 'string' or coalesce(item->>'visitaId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(item->>'ocorrenciaId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or length(btrim(item->>'fonteDiaUtil')) not between 1 and 500) then raise exception 'itens_invalidos' using errcode='22023'; end if;
 if (select count(distinct (item->>'visitaId')::uuid) from jsonb_array_elements(p_itens) x(item))<>jsonb_array_length(p_itens) or (select count(distinct (item->>'ocorrenciaId')::uuid) from jsonb_array_elements(p_itens) x(item))<>jsonb_array_length(p_itens) then raise exception 'itens_duplicados' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select jsonb_agg(item order by (item->>'visitaId')::uuid) into v_itens from jsonb_array_elements(p_itens) x(item);
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'expectedRevision',p_expected_revision,'itens',v_itens);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lote-visita:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_lotes_visita_canonica where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 select revisao into v_rev from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or v_rev<>p_expected_revision then raise exception 'revisao_ou_plano_indisponivel' using errcode='40001'; end if;
 for v_item in select item from jsonb_array_elements(v_itens) x(item) order by (item->>'visitaId')::uuid loop
   v_resultados:=v_resultados||jsonb_build_array(pcm.sso_preparar_visita_canonica(gen_random_uuid(),p_cliente_id,(v_item->>'ocorrenciaId')::uuid,p_plano_id,p_versao_id,p_rotina_id,(v_item->>'visitaId')::uuid,p_expected_revision,btrim(v_item->>'fonteDiaUtil')));
 end loop;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'itens',v_resultados,'atomico',true,'osCriada',false,'tarefaAuvoCriada',false,'fonteFeriadosCompleta',false);
 insert into pcm.sso_lotes_visita_canonica(request_id,cliente_id,plano_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.lote_visita_preparado','planos_manutencao',p_plano_id,jsonb_build_object('requestId',p_request_id,'rotinaId',p_rotina_id,'quantidade',jsonb_array_length(v_itens)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_preparar_lote_visita_canonica(uuid,uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
