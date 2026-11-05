-- ADR-0176: classificação humana explícita; não prova conclusão nem libera validação.
create table pcm.retorno_campo_classificacoes (
  envelope_id uuid primary key references pcm.origem_campo_inbox(id),
  resolucao_id uuid not null references pcm.origem_campo_resolucoes(id),
  retorno_id uuid not null unique references pcm.retorno_os_preparado(id),
  request_id uuid not null unique, ator_id uuid not null references auth.users(id),
  payload jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.retorno_campo_classificacoes enable row level security;
alter table pcm.retorno_campo_classificacoes force row level security;
revoke all on pcm.retorno_campo_classificacoes from public,anon,authenticated,service_role;

create function pcm.sso_classificar_retorno_campo_manual(p_request_id uuid,p_cliente_id uuid,p_envelope_id uuid,
  p_resolucao_id uuid,p_retorno_id uuid,p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_envelope pcm.origem_campo_inbox%rowtype;
  v_resolucao pcm.origem_campo_resolucoes%rowtype; v_anterior pcm.retorno_campo_classificacoes%rowtype;
  v_os pcm.ordens_servico%rowtype; v_ocorrencia pcm.ocorrencias_rotina_preparadas%rowtype;
  v_snapshot jsonb; v_rotina jsonb; v_perguntas jsonb; v_item jsonb; v_contagem integer; v_payload jsonb;
begin
  if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false)
    or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then
    raise exception 'retorno_campo_bloqueado' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_envelope_id is null
    or p_resolucao_id is null or p_retorno_id is null or p_respostas is null
    or jsonb_typeof(p_respostas) is distinct from 'array' or octet_length(p_respostas::text)>262144 then
    raise exception 'classificacao_invalida' using errcode='22023'; end if;
  if jsonb_array_length(p_respostas) not between 1 and 1000 then raise exception 'classificacao_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then
    raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'envelopeId',p_envelope_id,'resolucaoId',p_resolucao_id,'retornoId',p_retorno_id,'respostas',p_respostas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('retorno-classificacao:' || p_request_id::text,0));
  select * into v_anterior from pcm.retorno_campo_classificacoes where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_actor or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'retornoId',v_anterior.retorno_id,'coberturaComprovada',false);
  end if;
  select * into v_envelope from pcm.origem_campo_inbox where id=p_envelope_id for share;
  if not found or v_envelope.integracao<>'auvo' then raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_resolucao from pcm.origem_campo_resolucoes where id=p_resolucao_id and envelope_id=p_envelope_id
    and cliente_id=p_cliente_id and resultado='os_identificada';
  if not found or exists(select 1 from pcm.origem_campo_resolucoes r where r.envelope_id=p_envelope_id
    and (r.criada_em,r.id)>(v_resolucao.criada_em,v_resolucao.id)) then
    raise exception 'resolucao_indisponivel_ou_obsoleta' using errcode='23514'; end if;
  select * into v_os from pcm.ordens_servico where id=v_resolucao.os_id and client_id=p_cliente_id and deleted_at is null
    and auvo_task_id=v_envelope.task_id for share;
  if not found or not exists(select 1 from pcm.clientes c where c.id=p_cliente_id and c.deleted_at is null
    and c.auvo_id::text=v_envelope.cliente_externo_id) then raise exception 'identidade_tarefa_nao_comprovada' using errcode='23514'; end if;
  select ocorr.* into v_ocorrencia from pcm.ocorrencias_rotina_vinculos vinc
    join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id
    join pcm.planos_manutencao plano on plano.id=ocorr.plano_id and plano.cliente_id=p_cliente_id
    where vinc.ocorrencia_legada_id=v_os.ocorrencia_preventiva_id;
  if not found then raise exception 'vinculo_ocorrencia_nao_comprovado' using errcode='23514'; end if;
  select v.snapshot into v_snapshot from pcm.plano_versoes v where v.id=v_ocorrencia.versao_id
    and v.plano_id=v_ocorrencia.plano_id and v.estado='aprovado';
  if jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
  select count(*),min(item::text)::jsonb into v_contagem,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') r(item)
    where item->>'id'=v_ocorrencia.rotina_id::text;
  v_perguntas:=v_rotina->'questionario'->'perguntas';
  if v_contagem<>1 or jsonb_typeof(v_perguntas) is distinct from 'array' then
    raise exception 'perguntas_historicas_invalidas' using errcode='23514'; end if;
  if jsonb_array_length(v_perguntas)=0 or exists(select 1 from jsonb_array_elements(v_perguntas) x(item) group by item->>'id' having item->>'id' is null or count(*)>1) then
    raise exception 'perguntas_historicas_invalidas' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_respostas) x(item) group by item->>'perguntaId' having item->>'perguntaId' is null or count(*)>1) then
    raise exception 'perguntas_duplicadas' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_respostas) loop
    if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item->'perguntaId') is distinct from 'string'
      or v_item->>'resultado' is null or v_item->>'resultado' not in ('ok','nao_ok','nao_aplicavel','nao_inspecionado','corrigido')
      or (v_item ? 'observacao' and jsonb_typeof(v_item->'observacao') not in ('string','null'))
      or length(coalesce(v_item->>'observacao',''))>4000
      or (v_item->>'resultado'='nao_aplicavel' and nullif(btrim(v_item->>'observacao'),'') is null)
      or not exists(select 1 from jsonb_array_elements(v_perguntas) q(item) where item->>'id'=v_item->>'perguntaId') then
      raise exception 'resposta_invalida' using errcode='22023'; end if;
  end loop;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then
    raise exception 'retorno_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem,cobertura_comprovada)
    values(p_retorno_id,p_cliente_id,v_os.id,v_ocorrencia.versao_id,v_ocorrencia.rotina_id,'inbox:'||p_envelope_id::text,'manual_declarado',false);
  insert into pcm.respostas_os_preparadas(id,retorno_id,chave_pergunta,resultado,obrigatoria,observacao)
    select gen_random_uuid(),p_retorno_id,item->>'perguntaId',item->>'resultado',true,nullif(btrim(item->>'observacao'),'')
    from jsonb_array_elements(p_respostas) x(item);
  insert into pcm.retorno_campo_classificacoes(envelope_id,resolucao_id,retorno_id,request_id,ator_id,payload)
    values(p_envelope_id,p_resolucao_id,p_retorno_id,p_request_id,v_actor,v_payload);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.retorno_classificado_manual','ordens_servico',v_os.id,
    jsonb_build_object('requestId',p_request_id,'retornoId',p_retorno_id,'envelopeId',p_envelope_id,'resolucaoId',p_resolucao_id));
  return jsonb_build_object('requestId',p_request_id,'retornoId',p_retorno_id,'coberturaComprovada',false);
end;
$$;
revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

-- Metadados do envelope e perguntas históricas; não retorna payload bruto ou afirma evidência.
create function pcm.sso_listar_envelopes_classificaveis(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(envelope_id uuid,resolucao_id uuid,os_id uuid,task_id text,ocorrido_em timestamptz,recebido_em timestamptz,perguntas jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false)
    or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'retorno_campo_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select i.id,r.id,os.id,i.task_id::text,i.ocorrido_em,i.recebido_em,
    coalesce((select jsonb_agg(jsonb_build_object('id',q.item->>'id','texto',
      case when jsonb_typeof(q.item->'texto')='string' then left(q.item->>'texto',2000) else null end) order by q.ord)
      from jsonb_array_elements(case when jsonb_typeof(rot.item->'questionario'->'perguntas')='array'
        then rot.item->'questionario'->'perguntas' else '[]'::jsonb end) with ordinality q(item,ord)),'[]'::jsonb)
    from pcm.origem_campo_inbox i
    join lateral (select rr.* from pcm.origem_campo_resolucoes rr where rr.envelope_id=i.id order by rr.criada_em desc,rr.id desc limit 1) r on r.resultado='os_identificada' and r.cliente_id=p_cliente_id
    join pcm.clientes c on c.id=p_cliente_id and c.deleted_at is null and c.auvo_id::text=i.cliente_externo_id
    join pcm.ordens_servico os on os.id=r.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.auvo_task_id=i.task_id
    join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id
    join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id
    join pcm.planos_manutencao plano on plano.id=ocorr.plano_id and plano.cliente_id=p_cliente_id
    join pcm.plano_versoes v on v.id=ocorr.versao_id and v.plano_id=plano.id and v.estado='aprovado'
    join lateral jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) rot(item)
      on rot.item->>'id'=ocorr.rotina_id::text
    where i.integracao='auvo' and (p_apos is null or i.id>p_apos)
      and not exists(select 1 from pcm.retorno_campo_classificacoes classificacao where classificacao.envelope_id=i.id)
    order by i.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_envelopes_classificaveis(uuid,uuid,integer) from public,anon,authenticated,service_role;
