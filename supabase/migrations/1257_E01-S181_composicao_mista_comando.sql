-- ADR-1106: fontes de aquisição e parcelas operacionais, sem cobrança.
create function comercial.sso_preparar_orcamento_misto(
  p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_proposta_id uuid,p_expected_revision integer,
  p_lista_id uuid,p_lista_revision integer,p_descricao text,p_aquisicao_ids uuid[],p_fontes jsonb,p_fator numeric,p_preco_centavos bigint
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_comando comercial.sso_composicao_mista_comandos%rowtype; v_payload jsonb; v_fontes_validadas jsonb:='[]'::jsonb;
  v_aquisicoes jsonb:='[]'::jsonb; v_a comercial.sso_fontes_custo_aquisicao%rowtype; v_uso comercial.sso_usos_fonte_aquisicao%rowtype; v_id uuid;
  v_proposta comercial.propostas%rowtype; v_lista pcm.listas_materiais%rowtype; v_d pcm.despesas_visita%rowtype; v_vo pcm.visita_ordens_servico%rowtype;
  v_p pcm.despesa_visita_rateio_parcelas%rowtype; v_f jsonb; v_aquisicao numeric:=0; v_operacional numeric:=0; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_request_id is null or p_proposta_id is null or p_lista_id is null or p_expected_revision is null or p_expected_revision<1 or p_lista_revision is null or p_lista_revision<1 or p_descricao is null or pg_catalog.length(pg_catalog.btrim(p_descricao)) not between 1 and 4000 or p_fator is null or p_preco_centavos is null or p_fontes is null or jsonb_typeof(p_fontes)<>'array' or jsonb_array_length(p_fontes)>100 or p_aquisicao_ids is null or cardinality(p_aquisicao_ids)>100 or array_position(p_aquisicao_ids,null) is not null or (select count(distinct x) from unnest(p_aquisicao_ids) x)<>cardinality(p_aquisicao_ids) or (jsonb_array_length(p_fontes)=0 and cardinality(p_aquisicao_ids)=0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_fontes) e where jsonb_typeof(e)<>'object' or (e-'despesaId'-'despesaRevision'-'rateioRevision'-'vinculoId'-'grupo'-'valorCentavos'-'base'-'descricaoFonte')<>'{}'::jsonb
    or jsonb_typeof(e->'despesaId') is distinct from 'string' or e->>'despesaId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(e->'vinculoId') is distinct from 'string' or e->>'vinculoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(e->'rateioRevision') is distinct from 'number' or e->>'rateioRevision' !~ '^[1-9][0-9]{0,8}$'
    or jsonb_typeof(e->'despesaRevision') is distinct from 'number' or e->>'despesaRevision' !~ '^[1-9][0-9]{0,8}$'
    or jsonb_typeof(e->'valorCentavos') is distinct from 'number' or e->>'valorCentavos' !~ '^(0|[1-9][0-9]{0,12})$'
    or jsonb_typeof(e->'base') is distinct from 'string' or e->>'base' not in ('previsto','realizado')
    or jsonb_typeof(e->'descricaoFonte') is distinct from 'string' or pg_catalog.length(e->>'descricaoFonte') not between 1 and 10000
    or jsonb_typeof(e->'grupo') is distinct from 'string' or e->>'grupo' <> 'operacional') then raise exception 'fontes_invalidas' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_fontes) e group by (e->>'despesaId')::uuid,(e->>'vinculoId')::uuid having count(*)>1) then raise exception 'fonte_duplicada' using errcode='23505'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_composicao_mista_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'composicao_mista_desabilitada' using errcode='55000'; end if;
  perform 1 from comercial.sso_fonte_aquisicao_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'fonte_aquisicao_desabilitada' using errcode='55000'; end if;
  perform 1 from comercial.sso_composicao_parcelas_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'composicao_parcelas_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  v_payload:=pg_catalog.jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'expectedRevision',p_expected_revision,'listaId',p_lista_id,'listaRevision',p_lista_revision,'descricao',p_descricao,'aquisicaoIds',p_aquisicao_ids,'fontes',p_fontes,'fator',p_fator,'precoCentavos',p_preco_centavos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('composicao-mista:'||p_request_id::text,0));
  select * into v_comando from comercial.sso_composicao_mista_comandos where request_id=p_request_id;
  if found then
    if v_comando.ator_id is distinct from p_ator_id or v_comando.cliente_id is distinct from p_cliente_id then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  if exists(select 1 from comercial.sso_orcamento_operacional_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  -- Mesma ordem inicial do comando canônico. NOWAIT evita aguardar enquanto
  -- seguramos outras fontes; o operador deve reconsultar após contenção.
  select * into v_proposta from comercial.propostas where id=p_proposta_id and deleted_at is null for update nowait;
  if not found then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if v_proposta.oportunidade_id is not null then
    perform 1 from comercial.oportunidades o where o.id=v_proposta.oportunidade_id and o.cliente_id=p_cliente_id and o.deleted_at is null for share nowait;
    if not found then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  end if;
  select * into v_lista from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id for update nowait;
  if not found or v_lista.revisao<>p_lista_revision or v_lista.responsavel<>'sinergica' then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.ordens_servico os where os.id=v_lista.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null for share nowait;
  if not found then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  -- Retificações preservam correlações da fonte anterior; travar toda a cadeia em ordem.
  for v_id in with recursive ancestrais(id) as (
    select unnest(p_aquisicao_ids)
    union
    select r.fonte_anterior_id from comercial.sso_retificacoes_fonte_aquisicao r join ancestrais a on a.id=r.fonte_nova_id
  ) select id from ancestrais order by id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('uso-fonte-aquisicao:'||v_id::text,0));
  end loop;
  for v_id in select x from unnest(p_aquisicao_ids) x order by x loop
    select * into v_a from comercial.sso_fontes_custo_aquisicao where id=v_id and cliente_id=p_cliente_id and lista_id=p_lista_id and os_id=v_lista.ordem_servico_id for share nowait;
    if not found or v_a.lista_revisao is distinct from p_lista_revision then raise exception 'fonte_aquisicao_indisponivel_ou_obsoleta' using errcode='23514'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('uso-fonte-aquisicao:'||v_id::text,0));
    if exists(select 1 from comercial.sso_retificacoes_fonte_aquisicao where fonte_anterior_id=v_id) then raise exception 'fonte_aquisicao_substituida' using errcode='23514'; end if;
    select * into v_uso from comercial.sso_usos_fonte_aquisicao where fonte_id=v_id for update;
    if found and (v_uso.cliente_id is distinct from p_cliente_id or v_uso.proposta_id is distinct from p_proposta_id) then raise exception 'fonte_aquisicao_ja_utilizada' using errcode='23505'; end if;
    if not found then insert into comercial.sso_usos_fonte_aquisicao(fonte_id,proposta_id,cliente_id,request_id) values(v_id,p_proposta_id,p_cliente_id,p_request_id); end if;
    v_aquisicao:=v_aquisicao+v_a.valor_centavos;
    if v_aquisicao>1000000000000 then raise exception 'valor_excedido' using errcode='22023'; end if;
    v_aquisicoes:=v_aquisicoes||jsonb_build_array(jsonb_build_object('fonteId',v_a.id,'tipo',v_a.tipo,'listaRevision',v_a.lista_revisao,'valorCentavos',v_a.valor_centavos));
  end loop;
  for v_f in select e from jsonb_array_elements(p_fontes) e order by e->>'despesaId',e->>'vinculoId' loop
    select * into v_d from pcm.despesas_visita where id=(v_f->>'despesaId')::uuid and cliente_id=p_cliente_id and status='ativa' for share nowait;
    if not found then raise exception 'fonte_indisponivel' using errcode='23514'; end if;
    if v_d.revisao is distinct from (v_f->>'despesaRevision')::integer or v_d.descricao is distinct from v_f->>'descricaoFonte' or
      (case when v_d.realizado_centavos is null then 'previsto' else 'realizado' end) is distinct from v_f->>'base' then raise exception 'despesa_obsoleta' using errcode='40001'; end if;
    if (select max(r.revisao) from pcm.despesa_visita_rateios r where r.despesa_id=v_d.id) is distinct from (v_f->>'rateioRevision')::integer then raise exception 'rateio_obsoleto' using errcode='40001'; end if;
    select * into v_p from pcm.despesa_visita_rateio_parcelas where despesa_id=v_d.id and revisao=(v_f->>'rateioRevision')::integer and vinculo_id=(v_f->>'vinculoId')::uuid;
    if not found then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
    if v_p.valor_centavos is distinct from (v_f->>'valorCentavos')::bigint then raise exception 'valor_parcela_alterado' using errcode='40001'; end if;
    select * into v_vo from pcm.visita_ordens_servico where id=v_p.vinculo_id and visita_id=v_d.visita_id and cliente_id=p_cliente_id and os_id=v_lista.ordem_servico_id for share nowait;
    if not found then raise exception 'parcela_os_divergente' using errcode='23514'; end if;
    if v_f->>'grupo'='aquisicao' then v_aquisicao:=v_aquisicao+v_p.valor_centavos; else v_operacional:=v_operacional+v_p.valor_centavos; end if;
    if v_aquisicao>1000000000000 or v_operacional>1000000000000 then raise exception 'valor_excedido' using errcode='22023'; end if;
    v_fontes_validadas:=v_fontes_validadas || pg_catalog.jsonb_build_array(v_f || pg_catalog.jsonb_build_object('valorCentavos',v_p.valor_centavos,'despesaRevision',v_d.revisao,'base',case when v_d.realizado_centavos is null then 'previsto' else 'realizado' end));
  end loop;
  if exists(with recursive ancestrais(id) as (
      select unnest(p_aquisicao_ids)
      union
      select r.fonte_anterior_id from comercial.sso_retificacoes_fonte_aquisicao r join ancestrais a on a.id=r.fonte_nova_id
    ) select 1 from comercial.sso_correlacoes_gasto c join ancestrais a on a.id=c.fonte_id cross join lateral jsonb_array_elements(p_fontes) f
    where c.cliente_id=p_cliente_id and c.despesa_id=(f->>'despesaId')::uuid and c.vinculo_id=(f->>'vinculoId')::uuid
      and coalesce((select d.acao from comercial.sso_decisoes_correlacao_gasto d
        where d.correlacao_request_id=c.request_id order by d.revisao desc limit 1),'reativar') <> 'revogar')
    then raise exception 'fontes_com_correlacao_de_gasto' using errcode='23514'; end if;
  insert into comercial.sso_composicao_mista_tokens(txid,request_id,ator_id,proposta_id) values(pg_catalog.txid_current(),p_request_id,p_ator_id,p_proposta_id);
  v_resultado:=comercial.sso_preparar_orcamento_operacional(p_request_id,p_proposta_id,p_expected_revision,p_lista_id,p_lista_revision,p_descricao,v_aquisicao::bigint,v_operacional::bigint,p_fator,p_preco_centavos);
  delete from comercial.sso_composicao_mista_tokens where txid=pg_catalog.txid_current() and request_id=p_request_id and ator_id=p_ator_id;
  insert into comercial.sso_composicao_mista_comandos(request_id,ator_id,cliente_id,payload,fontes_validadas,aquisicoes_validadas,resultado) values(p_request_id,p_ator_id,p_cliente_id,v_payload,v_fontes_validadas,v_aquisicoes,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_preparar_orcamento_misto(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid[],jsonb,numeric,bigint) from public,anon,authenticated,service_role;
