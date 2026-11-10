-- ADR-1236: avalia cada rascunho de lote sem apagar histórico.
create table pcm.sso_reversao_lote_legado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reversao_lote_legado_gate(id,habilitado) values(true,false);
create table pcm.sso_reversoes_lote_legado(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  lote_request_id uuid not null references pcm.sso_lotes_rascunhos_legados(request_id),itens jsonb not null,
  motivo text not null,resultado jsonb not null,criado_em timestamptz not null default now(),
  check(jsonb_typeof(itens)='array'),check(jsonb_typeof(resultado)='object'),check(length(btrim(motivo)) between 1 and 2000)
);
alter table pcm.sso_reversao_lote_legado_gate enable row level security;
alter table pcm.sso_reversao_lote_legado_gate force row level security;
alter table pcm.sso_reversoes_lote_legado enable row level security;
alter table pcm.sso_reversoes_lote_legado force row level security;
revoke all on pcm.sso_reversao_lote_legado_gate,pcm.sso_reversoes_lote_legado from public,anon,authenticated,service_role;
create trigger sso_reversoes_lote_legado_imutaveis before update or delete on pcm.sso_reversoes_lote_legado
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_avaliar_reversao_lote_legado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_lote_request_id uuid,p_itens jsonb,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_reversoes_lote_legado%rowtype;v_lote pcm.sso_lotes_rascunhos_legados%rowtype;
  v_item jsonb;v_resultado_item jsonb;v_resultados jsonb:='[]'::jsonb;v_resultado jsonb;
  v_revertidos integer:=0;v_pendentes integer:=0;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_lote_request_id is null
    or v_motivo is null or length(v_motivo)>2000 or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if jsonb_array_length(p_itens) not between 1 and 20 or octet_length(p_itens::text)>16384 then raise exception 'limite_excedido' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_itens) e where jsonb_typeof(e) is distinct from 'object'
    or (e-'requestId'-'origemRequestId'-'revisao')<>'{}'::jsonb
    or coalesce(e->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(e->>'origemRequestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(e->>'revisao','') !~ '^[1-9][0-9]{0,8}$') then raise exception 'item_invalido' using errcode='22023'; end if;
  if (select count(distinct (e->>'requestId')::uuid) from jsonb_array_elements(p_itens) e)<>jsonb_array_length(p_itens)
    or (select count(distinct (e->>'origemRequestId')::uuid) from jsonb_array_elements(p_itens) e)<>jsonb_array_length(p_itens)
    or exists(select 1 from jsonb_array_elements(p_itens) e where (e->>'requestId')::uuid=p_request_id) then raise exception 'identidade_duplicada' using errcode='23505'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_reversao_lote_legado_gate where id and habilitado for share;
  if not found then raise exception 'reversao_lote_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_rascunho_plano_legado_gate where id and habilitado for share;
  if not found then raise exception 'migracao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_reversao_rascunho_legado_gate where id and habilitado for share;
  if not found then raise exception 'reversao_desabilitada' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reversao-lote-legado:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_reversoes_lote_legado where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.lote_request_id is distinct from p_lote_request_id
      or v_ant.itens is distinct from p_itens or v_ant.motivo is distinct from v_motivo then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  select * into v_lote from pcm.sso_lotes_rascunhos_legados where request_id=p_lote_request_id and cliente_id=p_cliente_id;
  if not found or jsonb_array_length(v_lote.itens)<>jsonb_array_length(p_itens)
    or exists(select 1 from jsonb_array_elements(p_itens) e where not exists(select 1 from jsonb_array_elements(v_lote.itens) origem
      where (origem->>'requestId')::uuid=(e->>'origemRequestId')::uuid)) then raise exception 'lote_ou_itens_indisponiveis' using errcode='42501'; end if;
  for v_item in select e from jsonb_array_elements(p_itens) e
    join pcm.sso_rascunhos_planos_legados r on r.request_id=(e->>'origemRequestId')::uuid and r.cliente_id=p_cliente_id
    order by r.plano_id loop
    v_resultado_item:=pcm.sso_reverter_rascunho_plano_legado(p_ator_id,p_cliente_id,(v_item->>'requestId')::uuid,
      (v_item->>'origemRequestId')::uuid,(v_item->>'revisao')::integer,v_motivo);
    if v_resultado_item->>'state'='revertido_logicamente' then v_revertidos:=v_revertidos+1;
    elsif v_resultado_item->>'state'='pendente_reconciliacao' then v_pendentes:=v_pendentes+1;
    else raise exception 'resultado_invalido' using errcode='23514'; end if;
    v_resultados:=v_resultados||jsonb_build_array(v_resultado_item);
  end loop;
  if v_revertidos+v_pendentes<>jsonb_array_length(p_itens) then raise exception 'itens_indisponiveis' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'loteRequestId',p_lote_request_id,
    'revertidos',v_revertidos,'pendentes',v_pendentes,'itens',v_resultados,'historicoApagado',false);
  insert into pcm.sso_reversoes_lote_legado(request_id,ator_id,cliente_id,lote_request_id,itens,motivo,resultado)
    values(p_request_id,p_ator_id,p_cliente_id,p_lote_request_id,p_itens,v_motivo,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'migracao.avaliar_reversao_lote','sso_reversoes_lote_legado',p_request_id,
    jsonb_build_object('clienteId',p_cliente_id,'loteRequestId',p_lote_request_id,'revertidos',v_revertidos,'pendentes',v_pendentes));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_avaliar_reversao_lote_legado(uuid,uuid,uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
