-- ADR-1429: execução autenticada e isolada por proposta; gate fechado.
create table pcm.sso_edicao_composicao_escopada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_edicao_composicao_escopada_gate(id,habilitado) values(true,false);
create table pcm.sso_edicoes_composicao_escopadas(
 request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
 proposta_id uuid not null references comercial.propostas(id), payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_edicao_composicao_escopada_gate enable row level security;
alter table pcm.sso_edicao_composicao_escopada_gate force row level security;
alter table pcm.sso_edicoes_composicao_escopadas enable row level security;
alter table pcm.sso_edicoes_composicao_escopadas force row level security;
revoke all on pcm.sso_edicao_composicao_escopada_gate,pcm.sso_edicoes_composicao_escopadas from public,anon,authenticated,service_role;
create trigger sso_edicao_composicao_imutavel before update or delete on pcm.sso_edicoes_composicao_escopadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_editar_composicao_proposta(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_expected_versao integer,
 p_snapshot text,p_itens jsonb,p_preco_centavos bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_anterior pcm.sso_edicoes_composicao_escopadas%rowtype; v_proposta comercial.propostas%rowtype; v_payload jsonb;
 v_item jsonb; v_itens jsonb:='[]'::jsonb; v_quantidade numeric; v_custo bigint; v_total bigint:=0; v_linha bigint;
 v_aliquota numeric; v_margem numeric; v_piso bigint; v_sugerido bigint; v_resultado jsonb; v_fotografia jsonb;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 perform 1 from pcm.sso_edicao_composicao_escopada_gate where id and habilitado for share;
 if not found then raise exception 'edicao_desabilitada' using errcode='55000'; end if;
 if p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_expected_versao is null or p_expected_versao<1
   or p_snapshot is null or p_snapshot !~ '^[0-9a-f]{32}$' or jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)>100 or p_preco_centavos is null or p_preco_centavos<0
   or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('composicao-escopada-proposta:'||p_proposta_id::text,0));
 perform pcm.sso_consultar_custos_proposta(p_cliente_id,p_proposta_id);
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',p_expected_versao,'snapshot',p_snapshot,'itens',p_itens,'preco',p_preco_centavos,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('composicao-escopada:'||p_request_id::text,0));
 select * into v_anterior from pcm.sso_edicoes_composicao_escopadas where request_id=p_request_id;
 if found then if v_anterior.ator_id is distinct from auth.uid() or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_anterior.resultado; end if;
 -- Abrange também inserções/exclusões legadas que não incrementam a versão.
 lock table comercial.proposta_itens in share row exclusive mode nowait;
 select * into v_proposta from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
 if not found or v_proposta.versao_atual<>p_expected_versao then raise exception 'versao_obsoleta' using errcode='40001'; end if;
 if v_proposta.status not in ('rascunho','em_revisao') then raise exception 'status_nao_editavel' using errcode='23514'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'tipo',i.tipo,'descricao',i.descricao,'nivelId',i.nivel_id,
   'materialId',i.material_id,'quantidade',i.quantidade,'custoUnitarioCentavos',i.custo_unitario_centavos) order by i.id),'[]'::jsonb)
 into v_fotografia from comercial.proposta_itens i where i.proposta_id=p_proposta_id;
 if pg_catalog.md5(v_fotografia::text) is distinct from p_snapshot then raise exception 'composicao_alterada' using errcode='40001'; end if;
 for v_item in select value from jsonb_array_elements(p_itens) loop
   if jsonb_typeof(v_item) is distinct from 'object' or (v_item - 'tipo' - 'descricao' - 'nivel_id' - 'material_id' - 'quantidade' - 'custo_unitario_centavos') <> '{}'::jsonb
      or v_item->>'tipo' not in ('mo','material','veiculo','outro') or jsonb_typeof(v_item->'descricao') is distinct from 'string'
      or length(btrim(v_item->>'descricao')) not between 1 and 2000 or jsonb_typeof(v_item->'quantidade') is distinct from 'number'
      or jsonb_typeof(v_item->'custo_unitario_centavos') is distinct from 'number' or coalesce(v_item->>'custo_unitario_centavos','') !~ '^[0-9]{1,12}$' then raise exception 'item_invalido' using errcode='22023'; end if;
   v_quantidade:=(v_item->>'quantidade')::numeric; v_custo:=(v_item->>'custo_unitario_centavos')::bigint;
   if v_quantidade<0 or v_quantidade>99999999.99 or v_quantidade<>round(v_quantidade,2) then raise exception 'quantidade_invalida' using errcode='22023'; end if;
   v_linha:=round(v_quantidade*v_custo)::bigint; v_total:=v_total+v_linha;
   if v_total>999999999999999 then raise exception 'valor_excedido' using errcode='22003'; end if;
   v_itens:=v_itens||jsonb_build_array(v_item||jsonb_build_object('total_centavos',v_linha));
 end loop;
 select margem_alvo_pct into v_margem from comercial.parametros_preco where id=1 for share;
 select aliquota_efetiva into v_aliquota from financeiro.fn_aliquota_efetiva_atual();
 if v_margem is null or v_aliquota is null or v_aliquota<0 or v_aliquota>=1 then raise exception 'parametros_preco_indisponiveis' using errcode='23514'; end if;
 v_piso:=round(v_total/(1-v_aliquota))::bigint; v_sugerido:=round(v_total*(1+v_margem/100)/(1-v_aliquota))::bigint;
 if p_preco_centavos<v_piso then raise exception 'preco_abaixo_piso' using errcode='23514'; end if;
 if config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_proposta:=comercial.fn_salvar_composicao_proposta(p_proposta_id,v_itens,v_total,v_piso,v_sugerido,p_preco_centavos,null,null,null);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',v_proposta.versao_atual);
 insert into pcm.sso_edicoes_composicao_escopadas(request_id,ator_id,cliente_id,proposta_id,payload,resultado) values(p_request_id,auth.uid(),p_cliente_id,p_proposta_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'comercial.composicao_escopada_editada','propostas',p_proposta_id,jsonb_build_object('requestId',p_request_id,'versaoAnterior',p_expected_versao,'versaoNova',v_proposta.versao_atual,'motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_editar_composicao_proposta(uuid,uuid,uuid,integer,text,jsonb,bigint,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_editar_composicao_proposta(uuid,uuid,uuid,integer,text,jsonb,bigint,text) to authenticated;
