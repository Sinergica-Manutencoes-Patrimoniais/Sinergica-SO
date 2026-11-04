-- ADR-0677: lote atômico de 0796, sem criar OS ou tarefa.
create table pcm.sso_lote_visita_legado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_lote_visita_legado_gate enable row level security;alter table pcm.sso_lote_visita_legado_gate force row level security;
revoke all on pcm.sso_lote_visita_legado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_lote_visita_legado_gate(id,habilitado) values(true,false);
create table pcm.sso_lotes_visita_legado(request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),plano_id uuid not null references pcm.planos_manutencao(id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_lotes_visita_legado enable row level security;alter table pcm.sso_lotes_visita_legado force row level security;
revoke all on pcm.sso_lotes_visita_legado from public,anon,authenticated,service_role;
create trigger sso_lote_visita_legado_imutavel before update or delete on pcm.sso_lotes_visita_legado for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_materializar_lote_visita_legado(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_legado_id uuid,p_relacao_id uuid,p_preparadas jsonb,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_ant pcm.sso_lotes_visita_legado%rowtype;v_item jsonb;v_itens jsonb;v_resultados jsonb:='[]'::jsonb;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_lote_visita_legado_gate where id),false) then raise exception 'lote_visita_legado_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_legado_id is null or p_relacao_id is null or jsonb_typeof(p_preparadas) is distinct from 'array' or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if jsonb_array_length(p_preparadas) not between 1 and 25 or exists(select 1 from jsonb_array_elements(p_preparadas) x(item) where jsonb_typeof(item) is distinct from 'string' or coalesce(item #>> '{}','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'itens_invalidos' using errcode='22023'; end if;
 if (select count(distinct (item #>> '{}')::uuid) from jsonb_array_elements(p_preparadas) x(item))<>jsonb_array_length(p_preparadas) then raise exception 'itens_duplicados' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select jsonb_agg(to_jsonb((item #>> '{}')::uuid) order by (item #>> '{}')::uuid) into v_itens from jsonb_array_elements(p_preparadas) x(item);
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'legadoId',p_legado_id,'relacaoId',p_relacao_id,'preparadas',v_itens,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lote-visita-legado:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_lotes_visita_legado where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 if not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) or exists(select 1 from jsonb_array_elements(v_itens) x(item) where not exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.id=(item #>> '{}')::uuid and o.plano_id=p_plano_id)) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 for v_item in select item from jsonb_array_elements(v_itens) x(item) order by (item #>> '{}')::uuid loop
   v_resultados:=v_resultados||jsonb_build_array(pcm.sso_materializar_visita_legado(gen_random_uuid(),p_cliente_id,(v_item #>> '{}')::uuid,p_legado_id,p_relacao_id,v_motivo));
 end loop;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'itens',v_resultados,'atomico',true,'planoLegadoCriado',false,'osCriada',false,'tarefaAuvoCriada',false,'filaOficialIntegrada',false);
 insert into pcm.sso_lotes_visita_legado(request_id,cliente_id,plano_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.lote_visita_legado_materializado','planos_manutencao',p_plano_id,jsonb_build_object('requestId',p_request_id,'quantidade',jsonb_array_length(v_itens),'motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_materializar_lote_visita_legado(uuid,uuid,uuid,uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
