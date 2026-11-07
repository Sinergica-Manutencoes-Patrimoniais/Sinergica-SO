-- ADR-1253: mantém gates do lote e da incorporação individual fechados.
create or replace function pcm.sso_criar_grupos_selecao(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;
 v_payload jsonb;v_resultado jsonb;v_item jsonb;v_individual jsonb;v_resultados jsonb:='[]'::jsonb;
 v_revision integer;v_request uuid;v_chave text;v_sync text;
begin
 if not coalesce((select habilitado from pcm.sso_criacao_grupos_lote_gate where id),false) or not coalesce((select habilitado from pcm.sso_incorporacao_aprovacao_gate where id),false) then raise exception 'criacao_lote_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if jsonb_array_length(p_itens) not between 1 and 50 then raise exception 'quantidade_invalida' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','criar_grupos_selecao','loteId',p_lote_id,'expectedRevision',p_expected_revision,'itens',p_itens);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if exists(select 1 from jsonb_array_elements(p_itens) x where jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'atributos') is distinct from 'object' or nullif(btrim(x->>'chave'),'') is null or nullif(btrim(x->>'requestId'),'') is null or nullif(btrim(x->>'localId'),'') is null or nullif(btrim(x->>'categoriaId'),'') is null or jsonb_typeof(x->'quantidade') is distinct from 'number' or jsonb_typeof(x->'codigoRevision') is distinct from 'number') then raise exception 'item_invalido' using errcode='22023';end if;
 if (select count(distinct x->>'chave') from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens) or (select count(distinct x->>'requestId') from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens) then raise exception 'item_duplicado' using errcode='22023';end if;
 v_revision:=p_expected_revision;v_sync:=current_setting('app.auvo_sync_write',true);perform pg_catalog.set_config('app.auvo_sync_write','true',true);
 for v_item in select value from jsonb_array_elements(p_itens) loop
  v_request:=(v_item->>'requestId')::uuid;v_chave:=v_item->>'chave';
  if v_request=p_request_id or exists(select 1 from pcm.sso_levantamento_comandos where request_id=v_request) then raise exception 'request_individual_ja_utilizado' using errcode='23505';end if;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=v_chave;
  if not found or v_linha.tipo<>'grupo_quantitativo' or v_linha.atributos is distinct from v_item->'atributos' then raise exception 'linha_divergente' using errcode='40001';end if;
  if exists(select 1 from jsonb_each(v_linha.atributos) x where x.key not in ('nome','referenciaPai','codigoInformado','quantidade') and x.value<>'null'::jsonb and x.value<>'""'::jsonb) then raise exception 'atributos_nao_suportados' using errcode='23514';end if;
  if nullif(btrim(v_linha.atributos->>'quantidade'),'') is not null then
   if v_linha.atributos->>'quantidade' !~ '^[0-9]{1,16}$' or (v_linha.atributos->>'quantidade')::numeric is distinct from (v_item->>'quantidade')::numeric then raise exception 'quantidade_informada_divergente' using errcode='23514';end if;
  end if;
  if v_item ? 'codigo' and jsonb_typeof(v_item->'codigo') not in ('string','null') then raise exception 'codigo_invalido' using errcode='22023';end if;
  v_individual:=pcm.sso_incorporar_ativo_codigo_staging(v_request,p_lote_id,v_revision,v_chave,(v_item->>'localId')::uuid,(v_item->>'categoriaId')::uuid,nullif(v_item->>'sistemaId','')::uuid,null,nullif(btrim(v_item->>'codigo'),''),(v_item->>'quantidade')::bigint,(v_item->>'codigoRevision')::integer);
  v_revision:=(v_individual->>'revision')::integer;v_resultados:=v_resultados||jsonb_build_array(jsonb_build_object('chave',v_chave,'resultado',v_individual));
 end loop;
 perform pg_catalog.set_config('app.auvo_sync_write',coalesce(v_sync,''),true);
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_revision,'requestId',p_request_id,'resultados',v_resultados,'atomicidade','integral');
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.criacao_grupos_selecao','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'quantidade',jsonb_array_length(p_itens),'revision',v_revision));
 return v_resultado;
end;$$;
