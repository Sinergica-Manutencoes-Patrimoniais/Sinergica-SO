-- ADR-0278: lote atômico, sem atividades externas.
create function pcm.sso_incorporar_lote_cronograma(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_lote_revision integer,p_plano_id uuid,p_expected_plano_revision integer,p_linhas jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_cmd pcm.sso_levantamento_comandos%rowtype;v_lote pcm.sso_levantamentos%rowtype;v_plano pcm.planos_manutencao%rowtype;
 v_payload jsonb;v_item jsonb;v_criado jsonb;v_resultado jsonb;v_itens jsonb:='[]'::jsonb;v_revisao integer;v_chave text;v_rotina uuid;v_item_request uuid;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_aprovacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_incorporacao_gate where id),false) then raise exception 'incorporacao_cronograma_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_lote_id is null or p_plano_id is null or p_expected_lote_revision is null or p_expected_lote_revision<1 or p_expected_plano_revision is null or p_expected_plano_revision<1 or jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 25 then raise exception 'lote_invalido' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_linhas) x where jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'chave') is distinct from 'string' or length(btrim(x->>'chave')) not between 1 and 200 or jsonb_typeof(x->'rotinaId') is distinct from 'string') then raise exception 'linha_invalida' using errcode='22023'; end if;
 if (select count(distinct x->>'chave') from jsonb_array_elements(p_linhas) x)<>jsonb_array_length(p_linhas) or (select count(distinct (x->>'rotinaId')::uuid) from jsonb_array_elements(p_linhas) x)<>jsonb_array_length(p_linhas) then raise exception 'linha_duplicada' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','incorporarLoteCronograma','clienteId',p_cliente_id,'loteId',p_lote_id,'expectedLoteRevision',p_expected_lote_revision,'planoId',p_plano_id,'expectedPlanoRevision',p_expected_plano_revision,'linhas',p_linhas);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id and origem='planilha' and chave_origem like 'cronograma:%' for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_cmd.resultado; end if;
 if v_lote.revisao<>p_expected_lote_revision or v_plano.revisao<>p_expected_plano_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_revisao:=p_expected_plano_revision;
 for v_item in select value from jsonb_array_elements(p_linhas) with ordinality as t(value,ord) order by ord loop
  v_chave:=v_item->>'chave';v_rotina:=(v_item->>'rotinaId')::uuid;v_item_request:=gen_random_uuid();
  v_criado:=pcm.sso_incorporar_linha_cronograma(v_item_request,p_cliente_id,p_lote_id,p_expected_lote_revision,v_chave,p_plano_id,v_revisao,v_rotina);
  v_revisao:=(v_criado->>'revision')::integer;
  v_itens:=v_itens||jsonb_build_array(jsonb_build_object('chave',v_chave,'rotinaId',v_rotina,'requestId',v_item_request,'revision',v_revisao));
 end loop;
 v_resultado:=jsonb_build_object('aggregateId',p_plano_id,'revision',v_revisao,'state','rascunho','requestId',p_request_id,'linhas',v_itens);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.lote_incorporado_rascunho','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'linhas',jsonb_array_length(p_linhas),'revision',v_revisao));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado); return v_resultado;
end; $$;
revoke all on function pcm.sso_incorporar_lote_cronograma(uuid,uuid,uuid,integer,uuid,integer,jsonb) from public,anon,authenticated,service_role;
