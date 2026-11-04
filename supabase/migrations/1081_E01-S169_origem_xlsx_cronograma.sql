-- ADR-0903. Preparação aditiva; gate fechado, sem ativação ou migração de dados.
create table pcm.sso_origem_xlsx_cronograma_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_origem_xlsx_cronograma_gate(id,habilitado) values(true,false);
alter table pcm.sso_origem_xlsx_cronograma_gate enable row level security;
alter table pcm.sso_origem_xlsx_cronograma_gate force row level security;
revoke all on pcm.sso_origem_xlsx_cronograma_gate from public,anon,authenticated,service_role;

create table pcm.sso_origens_xlsx_cronograma (
  lote_id uuid primary key references pcm.sso_levantamentos(id),
  cliente_id uuid not null references pcm.clientes(id),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bytea not null check (octet_length(bytes) between 1 and 5242880),
  criado_por uuid not null references config.usuarios(user_id),
  criado_em timestamptz not null default now()
);
alter table pcm.sso_origens_xlsx_cronograma enable row level security;
alter table pcm.sso_origens_xlsx_cronograma force row level security;
revoke all on pcm.sso_origens_xlsx_cronograma from public,anon,authenticated,service_role;

create function pcm.sso_receber_xlsx_cronograma(
  p_request uuid,p_lote uuid,p_cliente uuid,p_fonte text,p_matriz jsonb,p_base64 text,p_sha256 text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_habilitado boolean; v_bytes bytea; v_hash text; v_resultado jsonb; v_cliente_lote uuid;
  v_origem pcm.sso_origens_xlsx_cronograma%rowtype;
begin
  select habilitado into v_habilitado from pcm.sso_origem_xlsx_cronograma_gate where id for share;
  if v_habilitado is distinct from true then raise exception 'origem_xlsx_bloqueada' using errcode='55000'; end if;
  perform pcm.sso_exigir_mediacao_cronograma(p_cliente);
  if p_base64 is null or octet_length(p_base64) not between 1 and 6990508 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'origem_xlsx_invalida' using errcode='22023';
  end if;
  begin v_bytes := pg_catalog.decode(p_base64,'base64');
  exception when invalid_parameter_value or character_not_in_repertoire then raise exception 'origem_xlsx_invalida' using errcode='22023'; end;
  if octet_length(v_bytes) not between 1 and 5242880 then raise exception 'origem_xlsx_invalida' using errcode='22023'; end if;
  v_hash := pg_catalog.encode(pg_catalog.sha256(v_bytes),'hex');
  if v_hash is distinct from p_sha256 then raise exception 'digest_divergente' using errcode='22023'; end if;
  if p_request is null or p_lote is null or p_fonte is null or p_fonte <> btrim(p_fonte) or length(p_fonte) not between 1 and 188 then
    raise exception 'origem_xlsx_invalida' using errcode='22023';
  end if;
  -- Mesma ordem do receptor canônico; o resultado de replay pode conter created=true antigo.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array(p_cliente,'planilha','cronograma:' || p_fonte)::text,0));
  select cliente_id into v_cliente_lote from pcm.sso_levantamentos where id=p_lote for update;
  if found then
    if v_cliente_lote is distinct from p_cliente then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
    if not exists(select 1 from pcm.sso_origens_xlsx_cronograma where lote_id=p_lote) then
      raise exception 'origem_xlsx_exige_reconciliacao' using errcode='55000';
    end if;
  end if;
  v_resultado := pcm.sso_receber_cronograma_mediado(p_request,p_lote,p_cliente,p_fonte,p_matriz);
  select * into v_origem from pcm.sso_origens_xlsx_cronograma where lote_id=p_lote for update;
  if found then
    if v_origem.cliente_id is distinct from p_cliente or v_origem.sha256 is distinct from v_hash or v_origem.bytes is distinct from v_bytes then
      raise exception 'origem_xlsx_conflitante' using errcode='23505';
    end if;
  else
    if (v_resultado->>'created')::boolean is distinct from true then
      raise exception 'origem_xlsx_exige_reconciliacao' using errcode='55000';
    end if;
    insert into pcm.sso_origens_xlsx_cronograma(lote_id,cliente_id,sha256,bytes,criado_por)
      values(p_lote,p_cliente,v_hash,v_bytes,auth.uid());
    insert into audit.events(actor_id,action,entity,entity_id,payload)
      values(auth.uid(),'cronograma.origem_xlsx_recebida','sso_levantamentos',p_lote,
        jsonb_build_object('requestId',p_request,'clienteId',p_cliente,'tamanho',octet_length(v_bytes)));
  end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_receber_xlsx_cronograma(uuid,uuid,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_receber_xlsx_cronograma(uuid,uuid,uuid,text,jsonb,text,text) to authenticated;
