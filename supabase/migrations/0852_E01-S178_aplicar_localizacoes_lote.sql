create table pcm.sso_aplicar_localizacoes_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_aplicar_localizacoes_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_aplicar_localizacoes_lote_gate enable row level security;alter table pcm.sso_aplicar_localizacoes_lote_gate force row level security;
revoke all on pcm.sso_aplicar_localizacoes_lote_gate from public,anon,authenticated,service_role;
create function pcm.sso_aplicar_localizacoes_selecao(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_item jsonb;v_item_resultado jsonb;v_resultados jsonb:='[]'::jsonb;v_revision integer;v_request uuid;v_interno uuid;v_entidade uuid;v_snapshot jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_aplicar_localizacoes_lote_gate where id),false) or not coalesce((select habilitado from pcm.sso_aplicar_campos_localizacao_gate where id),false) then raise exception 'aplicacao_lote_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if jsonb_array_length(p_itens) not between 1 and 50 then raise exception 'quantidade_invalida' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','aplicar_localizacoes_selecao','loteId',p_lote_id,'expectedRevision',p_expected_revision,'itens',p_itens);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if exists(select 1 from jsonb_array_elements(p_itens) x where jsonb_typeof(x) is distinct from 'object' or nullif(btrim(x->>'chave'),'') is null or nullif(btrim(x->>'requestId'),'') is null or nullif(btrim(x->>'requestIndividual'),'') is null or nullif(btrim(x->>'motivo'),'') is null or x->'confirmado' is distinct from 'true'::jsonb or not (x ? 'entidadeId') or not (x ? 'snapshot') or (jsonb_typeof(x->'entidadeId') not in ('null','string')) or (jsonb_typeof(x->'snapshot') not in ('null','object')) or ((x->'entidadeId'='null'::jsonb)<>(x->'snapshot'='null'::jsonb))) then raise exception 'item_invalido' using errcode='22023';end if;
 if (select count(distinct x->>'chave') from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens) or (select count(distinct r.id) from jsonb_array_elements(p_itens) x cross join lateral (values(x->>'requestId'),(x->>'requestIndividual')) r(id))<>2*jsonb_array_length(p_itens) then raise exception 'item_ou_request_duplicado' using errcode='22023';end if;
 v_revision:=p_expected_revision;
 for v_item in select value from jsonb_array_elements(p_itens) loop
  v_request:=(v_item->>'requestId')::uuid;v_interno:=(v_item->>'requestIndividual')::uuid;
  if v_request=p_request_id or v_interno=p_request_id or exists(select 1 from pcm.sso_levantamento_comandos where request_id in (v_request,v_interno)) then raise exception 'request_individual_ja_utilizado' using errcode='23505';end if;
  v_entidade:=nullif(v_item->>'entidadeId','')::uuid;v_snapshot:=case when v_item->'snapshot'='null'::jsonb then null else v_item->'snapshot' end;
  v_item_resultado:=pcm.sso_aplicar_campos_localizacao(v_request,v_interno,p_lote_id,v_revision,v_item->>'chave',v_entidade,v_snapshot,v_item->>'motivo');
  v_revision:=(v_item_resultado->>'revision')::integer;v_resultados:=v_resultados||jsonb_build_array(jsonb_build_object('chave',v_item->>'chave','resultado',v_item_resultado));
 end loop;
 v_resultado:=jsonb_build_object('loteId',p_lote_id,'revision',v_revision,'requestId',p_request_id,'resultados',v_resultados,'atomicidade','integral');
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.aplicacao_localizacoes_selecao','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'quantidade',jsonb_array_length(p_itens),'revision',v_revision));return v_resultado;
end;$$;
revoke all on function pcm.sso_aplicar_localizacoes_selecao(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
