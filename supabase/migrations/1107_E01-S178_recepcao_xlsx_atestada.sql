-- ADR-0954: gate fechado, segredo não provisionado, sem EXECUTE operacional.
create table pcm.sso_estrutura_xlsx_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_estrutura_xlsx_gate(id,habilitado) values(true,false);
create table pcm.sso_estrutura_xlsx_recibos(
  request_id uuid primary key, cliente_id uuid not null references pcm.clientes(id), ator_id uuid not null references auth.users(id),
  origem text not null, aba text not null, destino text not null check(destino in ('lote','quarentena')),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), linhas_sha256 text not null check(linhas_sha256 ~ '^[a-f0-9]{64}$'),
  resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_estrutura_xlsx_gate enable row level security;alter table pcm.sso_estrutura_xlsx_gate force row level security;
alter table pcm.sso_estrutura_xlsx_recibos enable row level security;alter table pcm.sso_estrutura_xlsx_recibos force row level security;
revoke all on pcm.sso_estrutura_xlsx_gate,pcm.sso_estrutura_xlsx_recibos from public,anon,authenticated,service_role;
create trigger sso_estrutura_xlsx_recibos_imutaveis before update or delete on pcm.sso_estrutura_xlsx_recibos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_receber_estrutura_xlsx_atestada(p_request uuid,p_cliente uuid,p_origem text,p_aba text,p_destino text,
  p_linhas_texto text,p_base64 text,p_expira bigint,p_assinatura text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_agora bigint;v_bytes bytea;v_linhas jsonb;v_segredo text;v_qtd integer;
  v_msg text;v_assinatura bytea;v_recebida bytea;v_diferenca integer:=0;v_hash text;v_hash_linhas text;
  v_anterior pcm.sso_estrutura_xlsx_recibos%rowtype;v_resultado jsonb;
begin
  perform 1 from pcm.sso_estrutura_xlsx_gate where id and habilitado for share;
  if not found then raise exception 'estrutura_xlsx_desabilitada' using errcode='55000'; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_agora:=floor(extract(epoch from clock_timestamp()))::bigint;
  if v_ator is null or p_request is null or p_cliente is null or p_origem is null or p_origem<>btrim(p_origem) or length(p_origem) not between 1 and 200
    or p_aba is null or length(p_aba) not between 1 and 31 or p_destino is null or p_destino not in ('lote','quarentena')
    or p_expira is null or p_expira<v_agora or p_expira>v_agora+300 or p_assinatura is null or p_assinatura !~ '^[a-f0-9]{64}$'
    or p_linhas_texto is null or octet_length(p_linhas_texto) not between 1 and 1048576
    or p_base64 is null or octet_length(p_base64) not between 1 and 6990508 then raise exception 'atestado_invalido' using errcode='42501'; end if;
  begin v_bytes:=decode(p_base64,'base64');v_linhas:=p_linhas_texto::jsonb;
  exception when others then raise exception 'atestado_invalido' using errcode='42501'; end;
  if octet_length(v_bytes) not between 1 and 5242880 or jsonb_typeof(v_linhas) is distinct from 'array' then raise exception 'atestado_invalido' using errcode='42501'; end if;
  select count(*),min(decrypted_secret) into v_qtd,v_segredo from vault.decrypted_secrets where name='sso_estrutura_xlsx_atestado_v1';
  if v_qtd<>1 or v_segredo is null or v_segredo !~ '^[a-f0-9]{64}$' then raise exception 'atestado_indisponivel' using errcode='55000'; end if;
  v_hash:=encode(sha256(v_bytes),'hex');v_hash_linhas:=encode(sha256(convert_to(p_linhas_texto,'UTF8')),'hex');
  v_msg:=concat_ws(E'\n','sso-estrutura-xlsx-v1',v_ator::text,p_cliente::text,p_request::text,encode(convert_to(p_origem,'UTF8'),'hex'),
    encode(convert_to(p_aba,'UTF8'),'hex'),p_destino,v_hash,v_hash_linhas,p_expira::text);
  v_assinatura:=extensions.hmac(convert_to(v_msg,'UTF8'),decode(v_segredo,'hex'),'sha256');v_recebida:=decode(p_assinatura,'hex');
  for i in 0..31 loop v_diferenca:=v_diferenca | (get_byte(v_assinatura,i) # get_byte(v_recebida,i)); end loop;
  if v_diferenca<>0 then raise exception 'atestado_invalido' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('estrutura-xlsx:'||p_request::text,0));
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_anterior from pcm.sso_estrutura_xlsx_recibos where request_id=p_request;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.cliente_id is distinct from p_cliente or v_anterior.origem is distinct from p_origem
      or v_anterior.aba is distinct from p_aba or v_anterior.destino is distinct from p_destino or v_anterior.sha256 is distinct from v_hash
      or v_anterior.linhas_sha256 is distinct from v_hash_linhas then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_anterior.resultado;
  end if;
  -- A chave de origem também é usada pelo receptor legado sem distinção de aba.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('estrutura-xlsx-origem:'||jsonb_build_array(p_cliente,p_origem)::text,0));
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from pcm.sso_estrutura_xlsx_recibos where cliente_id=p_cliente and origem=p_origem) then
    raise exception 'origem_requer_recuperacao' using errcode='23505'; end if;
  if exists(select 1 from pcm.sso_levantamentos where cliente_id=p_cliente and origem='manual' and chave_origem=p_origem)
    or exists(select 1 from pcm.sso_quarentena_csv_lotes where cliente_id=p_cliente and chave_origem=p_origem) then
    raise exception 'origem_requer_reconciliacao' using errcode='23505'; end if;
  if p_destino='lote' then
    v_resultado:=pcm.sso_receber_levantamento_manual(p_request,p_cliente,'planilha',p_origem,v_linhas);
  else
    v_resultado:=pcm.sso_receber_quarentena_csv(p_request,p_cliente,p_origem,v_linhas);
  end if;
  v_resultado:=jsonb_build_object('requestId',p_request,'destino',p_destino,'recibo',v_resultado,'oficialAlterado',false);
  insert into pcm.sso_estrutura_xlsx_recibos(request_id,cliente_id,ator_id,origem,aba,destino,sha256,linhas_sha256,resultado)
    values(p_request,p_cliente,v_ator,p_origem,p_aba,p_destino,v_hash,v_hash_linhas,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.xlsx_atestado','sso_estrutura_xlsx_recibos',p_request,
    jsonb_build_object('clienteId',p_cliente,'requestId',p_request,'destino',p_destino,'sha256',v_hash));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_receber_estrutura_xlsx_atestada(uuid,uuid,text,text,text,text,text,bigint,text) from public,anon,authenticated,service_role;
