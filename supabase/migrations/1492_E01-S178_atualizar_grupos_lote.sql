-- ADR-1342: seleção explícita e atômica; não habilita a operação.
create table pcm.sso_atualizacao_grupos_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_atualizacao_grupos_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_atualizacao_grupos_lote_gate enable row level security;
alter table pcm.sso_atualizacao_grupos_lote_gate force row level security;
revoke all on pcm.sso_atualizacao_grupos_lote_gate from public,anon,authenticated,service_role;

create function pcm.sso_atualizar_grupos_lote(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;
 v_item jsonb;v_payload jsonb;v_resultado jsonb;v_individual jsonb;v_resultados jsonb:='[]'::jsonb;v_revision integer;v_request uuid;
 v_codigo_staging text;v_codigo_revision integer;
begin
 perform 1 from pcm.sso_atualizacao_grupos_lote_gate where id and habilitado for share;
 if not found then raise exception 'atualizacao_lote_desabilitada' using errcode='55000';end if;
 perform 1 from pcm.sso_preservar_caracteristicas_grupo_gate where id and habilitado for share;
 if not found then raise exception 'preservacao_caracteristicas_desabilitada' using errcode='55000';end if;
 if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1
   or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if jsonb_array_length(p_itens) not between 1 and 50 then raise exception 'quantidade_invalida' using errcode='22023';end if;
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 v_payload:=jsonb_build_object('operacao','atualizar_grupos_lote','loteId',p_lote_id,'expectedRevision',p_expected_revision,'itens',p_itens);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then
  if v_cmd.ator_id is distinct from v_ator or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;
  return v_cmd.resultado;
 end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if exists(select 1 from jsonb_array_elements(p_itens) x where jsonb_typeof(x) is distinct from 'object'
   or nullif(btrim(x->>'chave'),'') is null or nullif(btrim(x->>'grupoId'),'') is null or nullif(btrim(x->>'localId'),'') is null
   or nullif(btrim(x->>'requestId'),'') is null or jsonb_typeof(x->'atributos') is distinct from 'object'
   or jsonb_typeof(x->'caracteristicas') is distinct from 'object' or jsonb_typeof(x->'grupoRevision') is distinct from 'number'
   or not (x ?& array['codigoStaging','codigoRevision']) or jsonb_typeof(x->'codigoRevision') is distinct from 'number'
   or jsonb_typeof(x->'codigoStaging') not in ('string','null')
   or nullif(btrim(x->>'motivo'),'') is null or length(btrim(x->>'motivo'))>2000) then raise exception 'item_invalido' using errcode='22023';end if;
 if (select count(distinct x->>'chave') from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens)
   or (select count(distinct (x->>'grupoId')::uuid) from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens)
   or (select count(distinct (x->>'requestId')::uuid) from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens)
   or exists(select 1 from (select (x->>'grupoId')::uuid id,lag((x->>'grupoId')::uuid) over(order by ord) anterior from jsonb_array_elements(p_itens) with ordinality t(x,ord)) q where q.anterior>=q.id)
   then raise exception 'itens_duplicados_ou_fora_de_ordem' using errcode='22023';end if;
 v_revision:=p_expected_revision;
 for v_item in select value from jsonb_array_elements(p_itens) loop
  v_request:=(v_item->>'requestId')::uuid;
  if v_request=p_request_id or exists(select 1 from pcm.sso_levantamento_comandos where request_id=v_request)
    or exists(select 1 from pcm.sso_grupo_levantamento_motivos where request_id=v_request) then raise exception 'request_individual_ja_utilizado' using errcode='23505';end if;
  if not exists(select 1 from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.chave=v_item->>'chave'
    and l.tipo='grupo_quantitativo' and l.atributos=v_item->'atributos') then raise exception 'linha_divergente' using errcode='40001';end if;
  select s.codigo,s.revisao into v_codigo_staging,v_codigo_revision from pcm.sso_codigo_staging s
    where s.lote_id=p_lote_id and s.linha_chave=v_item->>'chave' for share nowait;
  if not found then v_codigo_staging:=null;v_codigo_revision:=0;end if;
  if v_codigo_staging is distinct from v_item->>'codigoStaging' or v_codigo_revision is distinct from (v_item->>'codigoRevision')::integer then
    raise exception 'codigo_staging_alterado' using errcode='40001';end if;
  v_individual:=pcm.sso_atualizar_grupo_motivado_autorizado(v_request,p_lote_id,v_revision,v_item->>'chave',
    (v_item->>'grupoId')::uuid,(v_item->>'grupoRevision')::integer,(v_item->>'localId')::uuid,v_item->'caracteristicas',v_item->>'motivo');
  v_revision:=(v_individual->>'revision')::integer;
  v_resultados:=v_resultados||jsonb_build_array(jsonb_build_object('chave',v_item->>'chave','resultado',v_individual));
 end loop;
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_revision,'requestId',p_request_id,'resultados',v_resultados,'atomicidade','integral');
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_ator,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.grupos_atualizados_lote','sso_levantamentos',p_lote_id,
  jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'quantidade',jsonb_array_length(p_itens),'revision',v_revision));
 return v_resultado;
end;$$;
revoke all on function pcm.sso_atualizar_grupos_lote(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atualizar_grupos_lote(uuid,uuid,integer,jsonb) to authenticated;
